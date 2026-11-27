import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/ad_service.dart';
import 'core/admob_config.dart';
import 'core/api_client.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DjoumaFootLiveApp());
}

class DjoumaFootLiveApp extends StatelessWidget {
  const DjoumaFootLiveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DJOUMA FOOT LIVE',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF09090E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF8B5CF6),
          secondary: Color(0xFFA78BFA),
          surface: Color(0xFF12121A),
        ),
        useMaterial3: true,
      ),
      home: const MainShell(),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  final ApiClient _api = ApiClient(
    baseUrl: const String.fromEnvironment('BACKEND_URL', defaultValue: 'http://10.0.2.2:3000'),
  );
  final AdService _adService = AdService();

  // 12 sections:
  // 0 Accueil, 1 Direct, 2 Tous les matchs, 3 Pays, 4 Championnats,
  // 5 Resultats, 6 Classements, 7 Calendrier, 8 Statistiques,
  // 9 Equipes, 10 Joueurs, 11 Notifications
  int _sectionIndex = 0;

  List<dynamic> _matches = [];
  List<dynamic> _competitions = [];
  List<dynamic> _countries = [];
  String _selectedCountry = '';
  String _selectedStandingCompId = '';
  List<dynamic> _standingRows = [];

  Set<String> _favoriteClubIds = {};
  bool _loading = true;
  bool _isViewingMatch = false;
  bool _isImportantActionActive = false;
  bool _bonusUnlocked = false;
  bool _notifGoals = true;
  bool _notifCards = true;
  bool _notifFinal = true;

  String? _error;
  String _providerName = 'Flux Officiel Live';
  String _lastDataSignature = '';
  String _lastRealUpdateTime = '--:--:--';
  String _displayClock1s = '--:--:--';
  bool _isOfflineCached = false;

  Timer? _uiClockTimer;
  Timer? _backendPollTimer;

  BannerAd? _homeBanner;
  bool _bannerLoaded = false;

  static const List<Map<String, dynamic>> _sections = [
    {'id': 0, 'label': 'Accueil', 'icon': Icons.home_outlined},
    {'id': 1, 'label': 'Matchs en direct', 'icon': Icons.sensors},
    {'id': 2, 'label': 'Tous les matchs', 'icon': Icons.list_alt},
    {'id': 3, 'label': 'Pays', 'icon': Icons.public},
    {'id': 4, 'label': 'Championnats', 'icon': Icons.emoji_events_outlined},
    {'id': 5, 'label': 'Résultats', 'icon': Icons.check_circle_outline},
    {'id': 6, 'label': 'Classements', 'icon': Icons.leaderboard_outlined},
    {'id': 7, 'label': 'Calendrier', 'icon': Icons.calendar_today_outlined},
    {'id': 8, 'label': 'Statistiques', 'icon': Icons.bar_chart_outlined},
    {'id': 9, 'label': 'Équipes', 'icon': Icons.shield_outlined},
    {'id': 10, 'label': 'Joueurs', 'icon': Icons.people_outline},
    {'id': 11, 'label': 'Notifications', 'icon': Icons.notifications_outlined},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _update1sClock();
    _loadFavorites();
    _loadInitialData();
    _initAds();

    // Actualisation visuelle chaque seconde (séparée des appels réseau Sportradar)
    _uiClockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) _update1sClock();
    });

    // Synchronisation backend partagée toutes les 15s (cache serveur + Firestore)
    _backendPollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _loadMatches(silent: true);
    });
  }

  void _update1sClock() {
    final now = DateTime.now();
    setState(() {
      _displayClock1s =
          '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}';
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      final viewingLiveTab = _sectionIndex == 1 && _matches.any((m) => m['status'] == 'live');
      _adService.showAppOpenAdIfAvailable(
        isBlockedByActiveFlow: _isViewingMatch || _isImportantActionActive || viewingLiveTab,
      );
      _loadMatches(silent: true);
    }
  }

  Future<void> _initAds() async {
    final ready = await _adService.initializeWithConsent(
      onAdsReady: () {
        _loadHomeBanner();
        _adService.loadAndMaybeShowAppOpenOnLaunch(
          canInterruptSafely: () =>
              mounted && !_isViewingMatch && !_isImportantActionActive && _sectionIndex != 1,
        );
      },
    );
    if (ready && mounted) {
      _loadHomeBanner();
      _adService.loadAndMaybeShowAppOpenOnLaunch(
        canInterruptSafely: () =>
            mounted && !_isViewingMatch && !_isImportantActionActive && _sectionIndex != 1,
      );
    }
  }

  void _loadHomeBanner() {
    if (!mounted || _homeBanner != null) return;
    _homeBanner = _adService.createHomeBanner(
      onLoaded: () {
        if (mounted) setState(() => _bannerLoaded = true);
      },
      onFailed: () {
        if (mounted) {
          _homeBanner = null;
          setState(() => _bannerLoaded = false);
        }
      },
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _uiClockTimer?.cancel();
    _backendPollTimer?.cancel();
    _homeBanner?.dispose();
    _adService.dispose();
    super.dispose();
  }

  Future<void> _loadFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList('fav_clubs') ?? [];
    final bonusUntil = prefs.getInt('bonus_unlock_until') ?? 0;
    setState(() {
      _favoriteClubIds = raw.toSet();
      _bonusUnlocked = DateTime.now().millisecondsSinceEpoch < bonusUntil;
    });
  }

  Future<void> _toggleFavorite(String clubId) async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      if (_favoriteClubIds.contains(clubId)) {
        _favoriteClubIds.remove(clubId);
      } else {
        _favoriteClubIds.add(clubId);
      }
    });
    await prefs.setStringList('fav_clubs', _favoriteClubIds.toList());
  }

  Future<void> _unlockBonusWithRewardedAd() async {
    final shown = await _adService.showRewardedAd(onRewardEarned: () async {
      final prefs = await SharedPreferences.getInstance();
      final until = DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch;
      await prefs.setInt('bonus_unlock_until', until);
      if (mounted) {
        setState(() => _bonusUnlocked = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Analyse tactique bonus débloquée pour 24h !')),
        );
      }
    });
    if (!shown && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Publicité indisponible pour le moment. Les scores restent accessibles.'),
        ),
      );
    }
  }

  Future<void> _loadInitialData() async {
    await Future.wait([_loadMatches(), _loadCompetitions(), _loadCountries()]);
  }

  Future<void> _loadMatches({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; });
    try {
      final today = DateTime.now().toIso8601String().substring(0, 10);
      final data = await _api.getMatches(dateYmd: today);
      final incomingSig = (data['dataSignature'] ?? '').toString();
      final changed = incomingSig != _lastDataSignature || _lastDataSignature.isEmpty;

      setState(() {
        _matches = (data['matches'] as List?) ?? [];
        _providerName = (data['providerName'] ?? _providerName).toString();
        _isOfflineCached = false;
        if (changed) {
          _lastDataSignature = incomingSig;
          final iso = (data['lastRealUpdateIso'] ?? '').toString();
          if (iso.isNotEmpty && iso.length >= 19) {
            final dt = DateTime.tryParse(iso)?.toLocal();
            if (dt != null) {
              _lastRealUpdateTime =
                  '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')}';
            }
          } else {
            _lastRealUpdateTime = _displayClock1s;
          }
        }
        _loading = false;
      });
    } catch (e) {
      if (!silent && _matches.isEmpty) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      } else {
        setState(() => _isOfflineCached = true);
      }
    }
  }

  Future<void> _loadCompetitions() async {
    try {
      final data = await _api.getCompetitions();
      final list = ((data['competitions'] as List?) ?? []).where((c) => c['available'] == true).toList();
      setState(() {
        _competitions = list;
        if (_selectedStandingCompId.isEmpty && list.isNotEmpty) {
          _selectedStandingCompId = list.first['id'].toString();
          _loadStandings(_selectedStandingCompId);
        }
      });
    } catch (_) {}
  }

  Future<void> _loadCountries() async {
    try {
      final data = await _api.getCountries();
      final list = (data['countries'] as List?) ?? [];
      setState(() {
        _countries = list;
        if (_selectedCountry.isEmpty && list.isNotEmpty) {
          _selectedCountry = list.first['country'].toString();
        }
      });
    } catch (_) {}
  }

  Future<void> _loadStandings(String compId) async {
    try {
      final data = await _api.getStandings(compId);
      final tables = (data['tables'] as List?) ?? [];
      setState(() {
        _standingRows = tables.isNotEmpty ? ((tables.first['rows'] as List?) ?? []) : [];
      });
    } catch (_) {
      setState(() => _standingRows = []);
    }
  }

  void _onSectionSelected(int nextIndex) {
    if (nextIndex != _sectionIndex) {
      _adService.maybeShowInterstitialOnTransition(isViewingMatchOrVideo: _isViewingMatch);
    }
    setState(() => _sectionIndex = nextIndex);
  }

  void _openMatchDetail(dynamic match) async {
    setState(() => _isViewingMatch = true);
    Map<String, dynamic>? detail;
    try {
      detail = await _api.getMatchDetail(
        match['competitionId'].toString(),
        match['id'].toString(),
      );
    } catch (_) {}

    if (!mounted) return;
    final stats = (detail?['statistics'] as List?) ?? [];

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F0F16),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.72,
        maxChildSize: 0.92,
        minChildSize: 0.45,
        expand: false,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              '${match['home']['name']} ${match['home']['score'] ?? '-'} : ${match['away']['score'] ?? '-'} ${match['away']['name']}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text('${match['competitionName']} · ${match['statusText']} ${match['minuteDisplay'] ?? ''}'),
            const SizedBox(height: 16),
            if (stats.isNotEmpty) ...[
              const Text('Statistiques officielles', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ...stats.map((st) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(st['homeValue'].toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text(st['label'].toString(), style: const TextStyle(color: Colors.white70)),
                        Text(st['awayValue'].toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  )),
              const SizedBox(height: 16),
            ],
            if (!_bonusUnlocked)
              ElevatedButton.icon(
                onPressed: _unlockBonusWithRewardedAd,
                icon: const Icon(Icons.play_circle_outline),
                label: const Text('Débloquer analyse bonus (Vidéo récompensée)'),
              )
            else
              const Text(
                'Analyse Tactique Bonus active (24h)',
                style: TextStyle(color: Color(0xFFA78BFA), fontWeight: FontWeight.w600),
              ),
          ],
        ),
      ),
    );
    if (mounted) setState(() => _isViewingMatch = false);
  }

  @override
  Widget build(BuildContext context) {
    final liveMatches = _matches.where((m) => m['status'] == 'live').toList();
    final finishedMatches = _matches.where((m) => m['status'] == 'finished').toList();
    final upcomingMatches = _matches.where((m) => m['status'] == 'upcoming').toList();

    final bottomNavTarget = _sectionIndex == 0
        ? 0
        : _sectionIndex == 1
            ? 1
            : _sectionIndex == 4
                ? 2
                : _sectionIndex == 9
                    ? 3
                    : 4;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF09090E),
        title: const Text('DJOUMA FOOT LIVE', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            tooltip: 'À propos & Confidentialité',
            onPressed: () async {
              setState(() => _isImportantActionActive = true);
              await showDialog(
                context: context,
                builder: (_) => AlertDialog(
                  backgroundColor: const Color(0xFF12121A),
                  title: const Text('DJOUMA FOOT LIVE'),
                  content: Text(
                    'Créée par Djouma Coulibaly.\n'
                    'Source : $_providerName\n'
                    'Mode AdMob : ${AdMobConfig.useProdAds ? 'Production officielle' : 'TEST Google'}\n'
                    'App ID : ${AdMobConfig.appId}\n'
                    'App Open : ${AdMobConfig.appOpenAdUnitId}',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () async {
                        Navigator.pop(context);
                        _homeBanner?.dispose();
                        _homeBanner = null;
                        setState(() => _bannerLoaded = false);
                        await _adService.resetConsentAndReload(onAdsReady: _loadHomeBanner);
                      },
                      child: const Text('Confidentialité pub'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Fermer'),
                    ),
                  ],
                ),
              );
              if (mounted) setState(() => _isImportantActionActive = false);
            },
          )
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF0F0F16),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(color: Color(0xFF161624)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('DJOUMA FOOT LIVE', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('12 rubriques · Temps réel', style: TextStyle(color: Color(0xFFA78BFA), fontSize: 12)),
                ],
              ),
            ),
            ..._sections.map((sec) {
              final id = sec['id'] as int;
              return ListTile(
                leading: Icon(sec['icon'] as IconData, color: _sectionIndex == id ? const Color(0xFF8B5CF6) : null),
                title: Text(sec['label'].toString()),
                selected: _sectionIndex == id,
                onTap: () {
                  Navigator.pop(context);
                  _onSectionSelected(id);
                },
              );
            }),
          ],
        ),
      ),
      body: Column(
        children: [
          // Barre de synchronisation 1s (affichage) vs Dernière véritable donnée
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: const Color(0xFF12121A),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _isOfflineCached ? 'Hors ligne (cache)' : 'Connecté · $_displayClock1s',
                  style: TextStyle(
                    fontSize: 11,
                    color: _isOfflineCached ? Colors.amber : Colors.greenAccent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Donnée réelle : $_lastRealUpdateTime',
                  style: const TextStyle(fontSize: 11, color: Colors.white70),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6)))
                : _error != null && _matches.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 12),
                            ElevatedButton(onPressed: _loadInitialData, child: const Text('Réessayer')),
                          ],
                        ),
                      )
                    : _buildActiveSectionBody(liveMatches, finishedMatches, upcomingMatches),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: const Color(0xFF0F0F16),
        indicatorColor: const Color(0xFF8B5CF6).withValues(alpha: 0.25),
        selectedIndex: bottomNavTarget,
        onDestinationSelected: (idx) {
          if (idx == 0) _onSectionSelected(0);
          else if (idx == 1) _onSectionSelected(1);
          else if (idx == 2) _onSectionSelected(4);
          else if (idx == 3) _onSectionSelected(9);
          else {
            _showAllSectionsSheet();
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Accueil'),
          NavigationDestination(icon: Icon(Icons.sensors), label: 'Direct'),
          NavigationDestination(icon: Icon(Icons.emoji_events_outlined), label: 'Ligues'),
          NavigationDestination(icon: Icon(Icons.shield_outlined), label: 'Équipes'),
          NavigationDestination(icon: Icon(Icons.apps), label: 'Plus'),
        ],
      ),
    );
  }

  void _showAllSectionsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F0F16),
      builder: (_) => GridView.count(
        padding: const EdgeInsets.all(16),
        crossAxisCount: 3,
        childAspectRatio: 1.4,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        children: _sections.map((sec) {
          final id = sec['id'] as int;
          return InkWell(
            onTap: () {
              Navigator.pop(context);
              _onSectionSelected(id);
            },
            child: Container(
              decoration: BoxDecoration(
                color: _sectionIndex == id ? const Color(0xFF8B5CF6) : const Color(0xFF151520),
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(sec['icon'] as IconData, size: 20),
                  const SizedBox(height: 6),
                  Text(
                    sec['label'].toString(),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildActiveSectionBody(
    List<dynamic> liveMatches,
    List<dynamic> finishedMatches,
    List<dynamic> upcomingMatches,
  ) {
    switch (_sectionIndex) {
      case 0:
        return Column(
          children: [
            Expanded(child: _buildMatchList(_matches, 'Aucun match officiel aujourd\'hui.')),
            if (_bannerLoaded && _homeBanner != null)
              SafeArea(
                top: false,
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  width: _homeBanner!.size.width.toDouble(),
                  height: _homeBanner!.size.height.toDouble() + 8,
                  child: AdWidget(ad: _homeBanner!),
                ),
              ),
          ],
        );
      case 1:
        return _buildMatchList(liveMatches, 'Aucun match en direct en ce moment.');
      case 2:
        return _buildMatchList(_matches, 'Aucun match disponible.');
      case 3:
        return _buildCountriesList();
      case 4:
        return _buildCompetitionsByCountry();
      case 5:
        return _buildMatchList(finishedMatches, 'Aucun match terminé enregistré.');
      case 6:
        return _buildStandingsScreen();
      case 7:
        return _buildMatchList(upcomingMatches, 'Aucun match à venir programmé.');
      case 8:
        return _buildMatchList(
          [...liveMatches, ...finishedMatches],
          'Sélectionnez un match pour voir ses statistiques complètes.',
        );
      case 9:
        return _buildTeamsList();
      case 10:
        return const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Sélectionnez un club dans Équipes ou un match en direct pour consulter les joueurs et statistiques individuelles.',
              textAlign: TextAlign.center,
            ),
          ),
        );
      case 11:
      default:
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Notifications en direct', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            SwitchListTile(
              title: const Text('Buts marqués'),
              value: _notifGoals,
              onChanged: (v) => setState(() => _notifGoals = v),
            ),
            SwitchListTile(
              title: const Text('Cartons'),
              value: _notifCards,
              onChanged: (v) => setState(() => _notifCards = v),
            ),
            SwitchListTile(
              title: const Text('Résultats finaux'),
              value: _notifFinal,
              onChanged: (v) => setState(() => _notifFinal = v),
            ),
          ],
        );
    }
  }

  Widget _buildMatchList(List<dynamic> list, String emptyMsg) {
    if (list.isEmpty) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(emptyMsg, textAlign: TextAlign.center)));
    }
    return RefreshIndicator(
      onRefresh: () => _loadMatches(),
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: list.length,
        itemBuilder: (_, i) {
          final m = list[i];
          final home = m['home'];
          final away = m['away'];
          final isFav = _favoriteClubIds.contains(home['id']);
          return Card(
            color: const Color(0xFF12121A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: ListTile(
              onTap: () => _openMatchDetail(m),
              title: Text('${home['name']}  ${home['score'] ?? '-'} : ${away['score'] ?? '-'}  ${away['name']}'),
              subtitle: Text('${m['competitionName']} · ${m['statusText']} ${m['minuteDisplay'] ?? ''}'),
              trailing: IconButton(
                icon: Icon(isFav ? Icons.star : Icons.star_border, color: isFav ? const Color(0xFF8B5CF6) : null),
                onPressed: () => _toggleFavorite(home['id'].toString()),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCountriesList() {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _countries.length,
      itemBuilder: (_, i) {
        final cg = _countries[i];
        final comps = (cg['competitions'] as List?) ?? [];
        return Card(
          color: const Color(0xFF12121A),
          child: ListTile(
            leading: const Icon(Icons.public, color: Color(0xFF8B5CF6)),
            title: Text(cg['country'].toString()),
            subtitle: Text('${comps.length} compétitions / divisions'),
            onTap: () {
              setState(() => _selectedCountry = cg['country'].toString());
              _onSectionSelected(4);
            },
          ),
        );
      },
    );
  }

  Widget _buildCompetitionsByCountry() {
    final filtered = _selectedCountry.isEmpty
        ? _competitions
        : _competitions.where((c) => c['country'] == _selectedCountry).toList();
    return Column(
      children: [
        if (_countries.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(12),
            child: DropdownButtonFormField<String>(
              value: _selectedCountry.isNotEmpty ? _selectedCountry : null,
              decoration: const InputDecoration(labelText: 'Pays', border: OutlineInputBorder()),
              items: _countries
                  .map((cg) => DropdownMenuItem<String>(
                        value: cg['country'].toString(),
                        child: Text(cg['country'].toString()),
                      ))
                  .toList(),
              onChanged: (val) => setState(() => _selectedCountry = val ?? ''),
            ),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: filtered.length,
            itemBuilder: (_, i) {
              final c = filtered[i];
              return Card(
                color: const Color(0xFF12121A),
                child: ListTile(
                  leading: const Icon(Icons.emoji_events, color: Color(0xFF8B5CF6)),
                  title: Text(c['name'] ?? ''),
                  subtitle: Text('${c['country']} · ${c['divisionLabel'] ?? 'Division'}'),
                  onTap: () {
                    setState(() => _selectedStandingCompId = c['id'].toString());
                    _loadStandings(_selectedStandingCompId);
                    _onSectionSelected(6);
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStandingsScreen() {
    return Column(
      children: [
        if (_competitions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(12),
            child: DropdownButtonFormField<String>(
              value: _selectedStandingCompId.isNotEmpty ? _selectedStandingCompId : null,
              decoration: const InputDecoration(labelText: 'Compétition', border: OutlineInputBorder()),
              items: _competitions
                  .map((c) => DropdownMenuItem<String>(
                        value: c['id'].toString(),
                        child: Text('${c['country']} - ${c['name']}'),
                      ))
                  .toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() => _selectedStandingCompId = val);
                  _loadStandings(val);
                }
              },
            ),
          ),
        Expanded(
          child: _standingRows.isEmpty
              ? const Center(child: Text('Classement indisponible pour cette compétition.'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _standingRows.length,
                  itemBuilder: (_, i) {
                    final row = _standingRows[i];
                    return ListTile(
                      leading: Text('${row['rank']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      title: Text(row['teamName'].toString()),
                      subtitle: Text('MJ ${row['played']} · Diff ${row['goalDifference']}'),
                      trailing: Text('${row['points']} pts', style: const TextStyle(color: Color(0xFFA78BFA), fontWeight: FontWeight.bold)),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildTeamsList() {
    final seen = <String, dynamic>{};
    for (final m in _matches) {
      seen[m['home']['id'].toString()] = {'team': m['home'], 'comp': m['competitionName']};
      seen[m['away']['id'].toString()] = {'team': m['away'], 'comp': m['competitionName']};
    }
    final items = seen.values.toList();
    if (items.isEmpty) return const Center(child: Text('Aucune équipe chargée.'));
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final t = items[i]['team'];
        return Card(
          color: const Color(0xFF12121A),
          child: ListTile(
            leading: const Icon(Icons.shield, color: Color(0xFF8B5CF6)),
            title: Text(t['name'].toString()),
            subtitle: Text(items[i]['comp'].toString()),
          ),
        );
      },
    );
  }
}
