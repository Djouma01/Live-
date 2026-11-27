import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home,
  Radio,
  Trophy,
  Star,
  Bell,
  Search,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Calendar,
  WifiOff,
  Download,
  X,
  Globe,
  ListChecks,
  CheckSquare,
  BarChart3,
  Shield,
  Users,
  Grid,
  Newspaper,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  computeMatchesDataSignature,
  DEFAULT_NOTIFICATION_PREFS,
  detectMatchChanges,
  filterMatches,
  formatLocalDateFr,
  groupCompetitionsByCountryAndDivision,
  groupMatchesByStatus,
  toYmdDate,
  type ClubNotificationPrefsMap,
  type CompetitionInfo,
  type CountryGroupInfo,
  type FavoriteClub,
  type FavoritesState,
  type LiveAlertNotification,
  type MatchItem,
  type NewsArticle,
  type NotificationPrefs,
  type PlayerProfileInfo,
  type TeamRef,
} from './lib/football';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { MatchCard } from './components/MatchCard';
import { MatchDetailModal } from './components/MatchDetailModal';
import { StandingsView } from './components/StandingsView';
import { AboutAndAlertsModal } from './components/AboutAndAlertsModal';
import { LiveSyncBar, type LiveConnectionState } from './components/LiveSyncBar';
import { CompetitionsHierarchyView } from './components/CompetitionsHierarchyView';
import { TeamsDirectoryView } from './components/TeamsDirectoryView';
import { PlayersDirectoryView } from './components/PlayersDirectoryView';
import { NotificationsCenterView } from './components/NotificationsCenterView';
import { StatsExplorerView } from './components/StatsExplorerView';
import {
  AdConsentBanner,
  AppOpenAdOverlay,
  HomeBannerAd,
  InterstitialAdOverlay,
  RewardedAdModal,
} from './components/AdMobComponents';
import {
  grantRewardUnlock,
  isRewardUnlocked,
  shouldShowAppOpenAd,
  shouldShowInterstitial,
  type AdConsentStatus,
  type RewardUnlocksMap,
} from './lib/admob';
import {
  fetchCompetitionsApi,
  fetchCountriesApi,
  fetchMatchesApi,
  fetchNewsApi,
  getApiBaseUrl,
} from './lib/apiClient';
import {
  loadUserPreferencesFromFirestore,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  subscribeToLiveCacheMeta,
  syncUserPreferencesToFirestore,
} from './lib/firebase';

export type NavSection =
  | 'home'
  | 'live'
  | 'all_matches'
  | 'countries'
  | 'competitions'
  | 'results'
  | 'standings'
  | 'schedule'
  | 'stats'
  | 'teams'
  | 'players'
  | 'notifications';

const LOGO_SRC = '/src/assets/images/djouma_foot_logo_1795516990634.jpg';
const STADIUM_FALLBACK_SRC = '/src/assets/images/stadium_violet_night_1795516993057.jpg';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavSection>('home');
  const [showMobileMenuSheet, setShowMobileMenuSheet] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => toYmdDate(new Date()));
  const [selectedCompetitionFilter, setSelectedCompetitionFilter] = useState<string>('all');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [selectedHierarchyCountry, setSelectedHierarchyCountry] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allMatchesStatusFilter, setAllMatchesStatusFilter] = useState<
    'all' | 'live' | 'upcoming' | 'finished'
  >('all');

  const [competitions, setCompetitions] = useState<CompetitionInfo[]>([]);
  const [countries, setCountries] = useState<CountryGroupInfo[]>([]);
  const [providerName, setProviderName] = useState<string>('Flux Officiel Live');
  const [hasApiFootballKey, setHasApiFootballKey] = useState<boolean>(false);
  const [sportradarConfigured, setSportradarConfigured] = useState<boolean>(false);

  const [cachedMatches, setCachedMatches] = useLocalStorage<MatchItem[]>(
    'djouma_foot_cached_matches_v1',
    []
  );
  const [matches, setMatches] = useState<MatchItem[]>(cachedMatches);
  const [matchesLoading, setMatchesLoading] = useState<boolean>(cachedMatches.length === 0);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [matchesStale, setMatchesStale] = useState<boolean>(false);

  // Séparation stricte entre ticker visuel 1s et horodatage réel de nouvelle donnée
  const [displayClockText, setDisplayClockText] = useState<string>(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [lastRealUpdateIso, setLastRealUpdateIso] = useState<string>('');
  const [hasFreshUpdate, setHasFreshUpdate] = useState<boolean>(false);
  const [sseState, setSseState] = useState<'connected' | 'reconnecting'>('reconnecting');
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(false);
  const lastDataSignatureRef = useRef<string>('');

  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);

  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);
  const [selectedStandingComp, setSelectedStandingComp] = useState<CompetitionInfo | null>(null);
  const [standingsPickerCompId, setStandingsPickerCompId] = useState<string>('');
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] =
    useState<PlayerProfileInfo | null>(null);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);

  const [favorites, setFavorites] = useLocalStorage<FavoritesState>('djouma_foot_favorites_v1', {
    clubs: [],
    competitions: [],
  });
  const [notifPrefs, setNotifPrefs] = useLocalStorage<NotificationPrefs>(
    'djouma_foot_notif_prefs_v1',
    DEFAULT_NOTIFICATION_PREFS
  );
  const [clubNotifPrefs, setClubNotifPrefs] = useLocalStorage<ClubNotificationPrefsMap>(
    'djouma_foot_club_notif_prefs_v1',
    {}
  );

  // Firebase Auth & Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [cloudSyncedAt, setCloudSyncedAt] = useState<string>('');

  const [toastAlerts, setToastAlerts] = useState<LiveAlertNotification[]>([]);
  const [alertHistory, setAlertHistory] = useState<LiveAlertNotification[]>([]);
  const prevMatchesRef = useRef<MatchItem[]>([]);

  // Google AdMob Consent, Rewarded Unlocks & Interstitial Frequency State
  const [adConsent, setAdConsent] = useLocalStorage<AdConsentStatus>(
    'djouma_foot_ad_consent_v1',
    'pending'
  );
  const [rewardUnlocks, setRewardUnlocks] = useLocalStorage<RewardUnlocksMap>(
    'djouma_foot_admob_rewards_v1',
    {}
  );
  const [lastAppOpenAt, setLastAppOpenAt] = useLocalStorage<number>(
    'djouma_foot_app_open_last_v1',
    0
  );
  const [showAppOpenAd, setShowAppOpenAd] = useState<boolean>(false);
  const [showInterstitial, setShowInterstitial] = useState<boolean>(false);
  const [showRewardedModal, setShowRewardedModal] = useState<boolean>(false);
  const appOpenLoadedAtRef = useRef<number>(Date.now());
  const appOpenLaunchCheckedRef = useRef<boolean>(false);
  const transitionsCountRef = useRef<number>(0);
  const lastInterstitialAtRef = useRef<number>(0);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const pushAlert = useCallback((alert: LiveAlertNotification) => {
    setToastAlerts((prev) => [alert, ...prev].slice(0, 3));
    setAlertHistory((prev) => [alert, ...prev].slice(0, 40));
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(alert.title, {
          body: alert.body,
          icon: '/pwa-192x192.png',
        });
      } catch {
        // Fallback already rendered via toastAlerts
      }
    }
  }, []);

  // 1-second UI visual display ticker (never calls Sportradar per user!)
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayClockText(
        new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const applyIncomingMatches = useCallback(
    (
      incoming: MatchItem[],
      meta: {
        stale?: boolean;
        providerName?: string;
        sportradarConfigured?: boolean;
        lastRealUpdateIso?: string;
        dataSignature?: string;
      }
    ) => {
      const nextSig = meta.dataSignature || computeMatchesDataSignature(incoming);
      const changed =
        nextSig !== lastDataSignatureRef.current || lastDataSignatureRef.current === '';

      if (meta.providerName) setProviderName(meta.providerName);
      if (typeof meta.sportradarConfigured === 'boolean') {
        setSportradarConfigured(meta.sportradarConfigured);
      }
      setMatchesStale(Boolean(meta.stale));

      if (changed) {
        lastDataSignatureRef.current = nextSig;
        setLastRealUpdateIso(meta.lastRealUpdateIso || new Date().toISOString());
        setHasFreshUpdate(true);

        const favClubSet = new Set(favorites.clubs.map((c) => c.id));
        const favCompSet = new Set(favorites.competitions);
        const alerts = detectMatchChanges(
          prevMatchesRef.current,
          incoming,
          notifPrefs,
          favClubSet,
          favCompSet,
          clubNotifPrefs
        );
        alerts.forEach(pushAlert);

        prevMatchesRef.current = incoming;
        setMatches(incoming);
        setCachedMatches(incoming.slice(0, 120));

        setTimeout(() => {
          setHasFreshUpdate(false);
        }, 4000);
      } else if (!lastRealUpdateIso && meta.lastRealUpdateIso) {
        setLastRealUpdateIso(meta.lastRealUpdateIso);
      }
    },
    [
      favorites.clubs,
      favorites.competitions,
      notifPrefs,
      clubNotifPrefs,
      pushAlert,
      setCachedMatches,
      lastRealUpdateIso,
    ]
  );

  const fetchCompetitionsAndCountries = useCallback(async () => {
    try {
      const [compJson, countryJson] = await Promise.all([
        fetchCompetitionsApi(),
        fetchCountriesApi().catch(() => null),
      ]);
      const comps = Array.isArray(compJson.competitions) ? compJson.competitions : [];
      setCompetitions(comps);
      if (compJson.providerName) setProviderName(compJson.providerName);
      setHasApiFootballKey(Boolean(compJson.hasApiFootballKey));
      setSportradarConfigured(Boolean(compJson.sportradarConfigured));

      if (countryJson && Array.isArray(countryJson.countries)) {
        setCountries(countryJson.countries);
      } else {
        setCountries(groupCompetitionsByCountryAndDivision(comps));
      }

      const firstAvail = comps.find((c) => c.available && c.hasStandings) || comps.find((c) => c.available);
      if (firstAvail && !standingsPickerCompId) {
        setStandingsPickerCompId(firstAvail.id);
      }
    } catch {
      // Keep graceful state
    }
  }, [standingsPickerCompId]);

  const fetchMatches = useCallback(
    async (silent = false) => {
      if (!isOnline) return;
      if (!silent) setMatchesLoading(true);
      setMatchesError(null);
      try {
        const json = await fetchMatchesApi(selectedDate, selectedCompetitionFilter);
        const incoming: MatchItem[] = Array.isArray(json.matches) ? json.matches : [];
        applyIncomingMatches(incoming, {
          stale: json.stale,
          providerName: json.providerName,
          sportradarConfigured: json.sportradarConfigured,
          lastRealUpdateIso: json.lastRealUpdateIso,
          dataSignature: json.dataSignature,
        });
      } catch (err: any) {
        if (matches.length === 0) {
          setMatchesError(err?.message || 'Erreur réseau lors du chargement des matchs.');
        }
      } finally {
        setMatchesLoading(false);
      }
    },
    [isOnline, selectedDate, selectedCompetitionFilter, applyIncomingMatches, matches.length]
  );

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const articles = await fetchNewsApi();
      setNews(Array.isArray(articles) ? articles : []);
    } catch {
      // Keep graceful
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitionsAndCountries();
    fetchNews();
  }, []);

  useEffect(() => {
    prevMatchesRef.current = [];
    lastDataSignatureRef.current = '';
    fetchMatches(false);
  }, [selectedDate, selectedCompetitionFilter]);

  // Auto-resume when returning online
  useEffect(() => {
    if (isOnline) {
      fetchMatches(true);
    }
  }, [isOnline]);

  // Shared Server-Sent Events live stream (only active for today + all competitions while online)
  useEffect(() => {
    const todayStr = toYmdDate(new Date());
    if (!isOnline || selectedDate !== todayStr || selectedCompetitionFilter !== 'all') {
      return;
    }

    const base = getApiBaseUrl();
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${base}/api/live-stream`);
      es.onopen = () => setSseState('connected');
      es.onerror = () => setSseState('reconnecting');
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload?.type === 'snapshot' && Array.isArray(payload.matches)) {
            setSseState('connected');
            setMatchesLoading(false);
            applyIncomingMatches(payload.matches, {
              stale: payload.stale,
              providerName: payload.providerName,
              lastRealUpdateIso: payload.lastRealUpdateIso,
              dataSignature: payload.dataSignature,
            });
          }
        } catch {
          // Ignore malformed chunk
        }
      };
    } catch {
      setSseState('reconnecting');
    }

    return () => {
      es?.close();
    };
  }, [isOnline, selectedDate, selectedCompetitionFilter, applyIncomingMatches]);

  // Firestore real-time live cache listener
  useEffect(() => {
    const unsub = subscribeToLiveCacheMeta((meta) => {
      if (meta) {
        setFirestoreConnected(true);
        if (meta.lastRealUpdateIso && !lastRealUpdateIso) {
          setLastRealUpdateIso(meta.lastRealUpdateIso);
        }
      }
    });
    return () => unsub();
  }, [lastRealUpdateIso]);

  // Firebase Auth subscription & bidirectional Cloud Firestore preferences sync
  useEffect(() => {
    const unsub = subscribeToAuth(async (u) => {
      setFirebaseUser(u);
      if (u) {
        try {
          const remote = await loadUserPreferencesFromFirestore(u);
          if (remote?.notifPrefs) {
            setNotifPrefs((prev) => ({ ...prev, ...remote.notifPrefs }));
          }
          if (remote?.favoriteCompetitionIds?.length) {
            setFavorites((prev) => ({
              ...prev,
              competitions: Array.from(
                new Set([...prev.competitions, ...remote.favoriteCompetitionIds])
              ),
            }));
          }
          setCloudSyncedAt(
            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          );
        } catch {
          // Graceful local fallback
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const t = setTimeout(() => {
      syncUserPreferencesToFirestore(firebaseUser, favorites, notifPrefs)
        .then(() => {
          setCloudSyncedAt(
            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          );
        })
        .catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [firebaseUser, favorites, notifPrefs]);

  const isFavoriteClub = useCallback(
    (teamId: string) => favorites.clubs.some((c) => c.id === teamId),
    [favorites.clubs]
  );

  const toggleFavoriteClub = useCallback(
    (team: TeamRef, match: MatchItem) => {
      setFavorites((prev) => {
        const exists = prev.clubs.some((c) => c.id === team.id);
        if (exists) {
          return { ...prev, clubs: prev.clubs.filter((c) => c.id !== team.id) };
        }
        const entry: FavoriteClub = {
          id: team.id,
          name: team.name,
          logo: team.logo,
          competitionId: match.competitionId,
          competitionName: match.competitionName,
        };
        return { ...prev, clubs: [...prev.clubs, entry] };
      });
    },
    [setFavorites]
  );

  const toggleFavoriteCompetition = useCallback(
    (compId: string) => {
      setFavorites((prev) => {
        const exists = prev.competitions.includes(compId);
        return {
          ...prev,
          competitions: exists
            ? prev.competitions.filter((id) => id !== compId)
            : [...prev.competitions, compId],
        };
      });
    },
    [setFavorites]
  );

  const availableCompetitions = useMemo(
    () => competitions.filter((c) => c.available),
    [competitions]
  );

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    availableCompetitions.forEach((c) => set.add(c.country));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [availableCompetitions]);

  const filteredMatches = useMemo(
    () =>
      filterMatches(matches, {
        competitionId: selectedCompetitionFilter,
        country: selectedCountryFilter,
        search: searchQuery,
      }),
    [matches, selectedCompetitionFilter, selectedCountryFilter, searchQuery]
  );

  const groupedMatches = useMemo(() => groupMatchesByStatus(filteredMatches), [filteredMatches]);
  const liveMatchesAll = useMemo(() => groupMatchesByStatus(matches).live, [matches]);
  const finishedMatchesAll = useMemo(() => groupMatchesByStatus(matches).finished, [matches]);
  const upcomingMatchesAll = useMemo(() => groupMatchesByStatus(matches).upcoming, [matches]);

  // AdMob App Open Ad (ouverture ou reprise uniquement)
  const tryTriggerAppOpenAd = useCallback(() => {
    const now = Date.now();
    const canShow = shouldShowAppOpenAd({
      isOnline,
      consentStatus: adConsent,
      isViewingMatchOrVideo: Boolean(selectedMatch) || showRewardedModal,
      isImportantActionActive: Boolean(selectedStandingComp) || showAboutModal || showInterstitial,
      isViewingLiveTab: activeTab === 'live' && liveMatchesAll.length > 0,
      lastShownAt: lastAppOpenAt,
      loadedAt: appOpenLoadedAtRef.current,
      now,
    });
    if (canShow) {
      setLastAppOpenAt(now);
      setShowAppOpenAd(true);
      appOpenLoadedAtRef.current = now;
    }
  }, [
    isOnline,
    adConsent,
    selectedMatch,
    showRewardedModal,
    selectedStandingComp,
    showAboutModal,
    showInterstitial,
    activeTab,
    liveMatchesAll.length,
    lastAppOpenAt,
    setLastAppOpenAt,
  ]);

  useEffect(() => {
    if (appOpenLaunchCheckedRef.current) return;
    if (adConsent === 'pending' || !isOnline) return;
    appOpenLaunchCheckedRef.current = true;
    const timer = setTimeout(() => {
      tryTriggerAppOpenAd();
    }, 350);
    return () => clearTimeout(timer);
  }, [adConsent, isOnline, tryTriggerAppOpenAd]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tryTriggerAppOpenAd();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [tryTriggerAppOpenAd]);

  const dateShortcuts = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const plus2 = new Date(today);
    plus2.setDate(today.getDate() + 2);
    return [
      { label: 'Hier', ymd: toYmdDate(yesterday) },
      { label: "Aujourd'hui", ymd: toYmdDate(today) },
      { label: 'Demain', ymd: toYmdDate(tomorrow) },
      { label: '+2 jours', ymd: toYmdDate(plus2) },
    ];
  }, []);

  const topBarNavItems: { id: NavSection; label: string }[] = [
    { id: 'home', label: 'Accueil' },
    { id: 'live', label: 'Direct' },
    { id: 'competitions', label: 'Championnats' },
    { id: 'standings', label: 'Classements' },
    { id: 'stats', label: 'Statistiques' },
  ];

  const all12Sections: {
    id: NavSection;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'Accueil', icon: Home },
    { id: 'live', label: 'Matchs en direct', icon: Radio },
    { id: 'all_matches', label: 'Tous les matchs', icon: ListChecks },
    { id: 'countries', label: 'Pays', icon: Globe },
    { id: 'competitions', label: 'Championnats', icon: Trophy },
    { id: 'results', label: 'Résultats', icon: CheckSquare },
    { id: 'standings', label: 'Classements', icon: Trophy },
    { id: 'schedule', label: 'Calendrier', icon: Calendar },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
    { id: 'teams', label: 'Équipes', icon: Shield },
    { id: 'players', label: 'Joueurs', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const handleNavChange = (tab: NavSection) => {
    setShowMobileMenuSheet(false);
    if (tab !== activeTab) {
      transitionsCountRef.current += 1;
      const now = Date.now();
      const canTrigger = shouldShowInterstitial({
        isOnline,
        consentStatus: adConsent,
        isViewingMatchOrVideo: Boolean(selectedMatch) || showRewardedModal,
        transitionsSinceLastAd: transitionsCountRef.current,
        lastAdShownAt: lastInterstitialAtRef.current,
        now,
      });
      if (canTrigger) {
        transitionsCountRef.current = 0;
        lastInterstitialAtRef.current = now;
        setShowInterstitial(true);
      }
    }
    setActiveTab(tab);
    if (tab !== 'competitions') {
      setSelectedStandingComp(null);
    }
  };

  const connectionState: LiveConnectionState = !isOnline
    ? 'offline'
    : sseState === 'connected' || matches.length > 0
    ? 'connected'
    : 'reconnecting';

  const standingsActiveComp = useMemo(() => {
    return (
      availableCompetitions.find((c) => c.id === standingsPickerCompId) ||
      availableCompetitions.find((c) => c.hasStandings) ||
      availableCompetitions[0] ||
      null
    );
  }, [availableCompetitions, standingsPickerCompId]);

  return (
    <div className="min-h-screen bg-[#09090E] text-[#F8FAFC] flex flex-col pb-20 md:pb-10 overflow-x-hidden">
      {/* Top Bar Contract: Strict 3 zones (Brand - 5 links - Primary Action) */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[#09090E]/92 backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleNavChange('home')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg"
          >
            <img
              src={LOGO_SRC}
              alt="Logo DJOUMA FOOT LIVE"
              className="w-8 h-8 rounded-lg object-cover border border-violet-500/40"
            />
            <span className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-white">
              DJOUMA FOOT LIVE
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6" aria-label="Navigation principale">
            {topBarNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavChange(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded ${
                    active ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {item.label}
                  {item.id === 'live' && liveMatchesAll.length > 0 && (
                    <span className="ml-1.5 font-mono text-xs text-violet-400 tabular-nums">
                      ({liveMatchesAll.length})
                    </span>
                  )}
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-violet-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              aria-label="Ouvrir les alertes et à propos"
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Alertes &amp; À propos</span>
              <span className="sm:hidden">Alertes</span>
            </button>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Connexion Internet interrompue — Derniers scores conservés, reprise automatique dès le retour du réseau.
          </span>
        </div>
      )}

      {/* Live Notifications Toast Stack */}
      {toastAlerts.length > 0 && (
        <div className="fixed top-16 right-4 z-40 w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none">
          {toastAlerts.map((alert) => (
            <div
              key={alert.id}
              role="status"
              className="pointer-events-auto rounded-2xl bg-[#161624] border border-violet-500/50 p-3.5 shadow-xl flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-violet-300">{alert.title}</p>
                <p className="text-sm text-white mt-0.5">{alert.body}</p>
              </div>
              <button
                type="button"
                aria-label="Fermer l'alerte"
                onClick={() => setToastAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-5">
        {/* Rail des 12 rubriques complètes */}
        <nav
          aria-label="Toutes les rubriques sportives"
          className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible pb-2 border-b border-white/8 no-scrollbar"
        >
          {all12Sections.map((sec) => {
            const Icon = sec.icon;
            const active = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleNavChange(sec.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#12121A] border border-white/8 text-zinc-300 hover:border-violet-500/40 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{sec.label}</span>
                {sec.id === 'live' && liveMatchesAll.length > 0 && (
                  <span className="font-mono text-[11px] tabular-nums opacity-90">
                    {liveMatchesAll.length}
                  </span>
                )}
              </button>
            );
          })}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/6 hover:bg-white/10 text-xs font-medium text-violet-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Installer Android
            </button>
          )}
        </nav>

        {/* Barre de synchronisation temps réel (séparation 1s vs donnée réelle) */}
        <LiveSyncBar
          connectionState={connectionState}
          displayClockText={displayClockText}
          lastRealUpdateIso={lastRealUpdateIso}
          hasFreshUpdate={hasFreshUpdate}
          providerName={providerName}
          sportradarConfigured={sportradarConfigured}
          firestoreConnected={firestoreConnected}
          stale={matchesStale}
          isRefreshing={matchesLoading}
          onManualRefresh={() => fetchMatches(false)}
        />

        {/* 1. ACCUEIL */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    Matchs du jour
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Scores officiels internationaux · {formatLocalDateFr(selectedDate + 'T12:00:00Z')}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {dateShortcuts.slice(0, 3).map((d) => (
                    <button
                      key={d.ymd}
                      type="button"
                      onClick={() => setSelectedDate(d.ymd)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        selectedDate === d.ymd
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#12121A] border border-white/10 text-zinc-300 hover:border-violet-500/40'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                  <label className="relative inline-flex items-center">
                    <span className="sr-only">Choisir une date</span>
                    <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                      aria-label="Sélectionner une date"
                      className="min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl bg-[#12121A] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un club ou une ligue..."
                    aria-label="Rechercher un club ou une ligue"
                    className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#12121A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <select
                  value={selectedCompetitionFilter}
                  onChange={(e) => setSelectedCompetitionFilter(e.target.value)}
                  aria-label="Filtrer par compétition"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#12121A] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                >
                  <option value="all">Toutes les compétitions ({availableCompetitions.length})</option>
                  {availableCompetitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.country})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  aria-label="Filtrer par pays ou zone"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#12121A] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                >
                  <option value="all">Tous les pays / zones</option>
                  {availableCountries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {matchesLoading && matches.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-32 rounded-2xl bg-[#12121A] border border-white/6 animate-pulse" />
                ))}
              </div>
            ) : matchesError && matches.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm text-zinc-200">{matchesError}</p>
                <button
                  type="button"
                  onClick={() => fetchMatches(false)}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
                >
                  Réessayer
                </button>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="p-10 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-2">
                <p className="text-base font-semibold text-white">Aucun match trouvé</p>
                <p className="text-sm text-zinc-400">
                  Aucun match officiel programmé pour cette date ou ces filtres.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedMatches.live.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-base font-semibold text-white">
                      En direct ({groupedMatches.live.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedMatches.live.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          isFavoriteClub={isFavoriteClub}
                          onToggleFavoriteClub={toggleFavoriteClub}
                          onSelectMatch={setSelectedMatch}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {groupedMatches.upcoming.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-base font-semibold text-white">
                      À venir ({groupedMatches.upcoming.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedMatches.upcoming.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          isFavoriteClub={isFavoriteClub}
                          onToggleFavoriteClub={toggleFavoriteClub}
                          onSelectMatch={setSelectedMatch}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {groupedMatches.finished.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-base font-semibold text-white">
                      Terminés ({groupedMatches.finished.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupedMatches.finished.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          isFavoriteClub={isFavoriteClub}
                          onToggleFavoriteClub={toggleFavoriteClub}
                          onSelectMatch={setSelectedMatch}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Actualités récentes sur l'accueil */}
            {news.length > 0 && (
              <section className="space-y-3 pt-4 border-t border-white/8">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-violet-400" />
                    Dernières actualités football
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {news.slice(0, 3).map((art) => (
                    <NewsCard key={art.id} article={art} />
                  ))}
                </div>
              </section>
            )}

            {/* Bannière publicitaire AdMob en bas de la page d'accueil uniquement */}
            <HomeBannerAd isOnline={isOnline} consentStatus={adConsent} />
          </div>
        )}

        {/* 2. MATCHS EN DIRECT */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Matchs en direct ({liveMatchesAll.length})
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Affichage actualisé chaque seconde · Diffusion temps réel partagée via serveur et Firestore
                </p>
              </div>
            </div>

            {liveMatchesAll.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-3">
                <Radio className="w-8 h-8 text-violet-400 mx-auto" />
                <h2 className="text-lg font-semibold text-white">Aucun match en direct en ce moment</h2>
                <p className="text-sm text-zinc-400 max-w-md mx-auto">
                  DJOUMA FOOT LIVE affiche uniquement les matchs officiels actuellement en cours. Consultez le calendrier ou tous les matchs du jour.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavChange('schedule')}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
                >
                  Voir le calendrier
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveMatchesAll.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isFavoriteClub={isFavoriteClub}
                    onToggleFavoriteClub={toggleFavoriteClub}
                    onSelectMatch={setSelectedMatch}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. TOUS LES MATCHS */}
        {activeTab === 'all_matches' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Tous les matchs ({filteredMatches.length})
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Vue unifiée par statut et pays pour la journée sélectionnée.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'live', label: 'En direct' },
                    { id: 'upcoming', label: 'À venir' },
                    { id: 'finished', label: 'Terminés' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setAllMatchesStatusFilter(st.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      allMatchesStatusFilter === st.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#12121A] border border-white/10 text-zinc-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const list =
                allMatchesStatusFilter === 'all'
                  ? filteredMatches
                  : filteredMatches.filter((m) => m.status === allMatchesStatusFilter);
              if (list.length === 0) {
                return (
                  <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center text-sm text-zinc-400">
                    Aucun match trouvé pour ce statut.
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      isFavoriteClub={isFavoriteClub}
                      onToggleFavoriteClub={toggleFavoriteClub}
                      onSelectMatch={setSelectedMatch}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 4. PAYS & 5. CHAMPIONNATS */}
        {(activeTab === 'countries' || activeTab === 'competitions') && (
          <>
            {selectedStandingComp ? (
              <StandingsView
                competition={selectedStandingComp}
                onBack={() => setSelectedStandingComp(null)}
                isFavoriteCompetition={favorites.competitions.includes(selectedStandingComp.id)}
                onToggleFavoriteCompetition={toggleFavoriteCompetition}
                isFavoriteClub={isFavoriteClub}
                onToggleFavoriteClub={toggleFavoriteClub}
                onSelectMatch={setSelectedMatch}
              />
            ) : (
              <CompetitionsHierarchyView
                mode={activeTab === 'countries' ? 'countries' : 'competitions'}
                competitions={competitions}
                countries={countries}
                favoriteCompetitionIds={favorites.competitions}
                sportradarConfigured={sportradarConfigured}
                initialCountry={selectedHierarchyCountry}
                onSelectCountryToCompetitions={(country) => {
                  setSelectedHierarchyCountry(country);
                  handleNavChange('competitions');
                }}
                onSelectCompetition={(comp) => setSelectedStandingComp(comp)}
                onToggleFavoriteCompetition={toggleFavoriteCompetition}
              />
            )}
          </>
        )}

        {/* 6. RÉSULTATS */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Résultats finaux ({finishedMatchesAll.length})
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Scores officiels des matchs terminés · {formatLocalDateFr(selectedDate + 'T12:00:00Z')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dateShortcuts.slice(0, 2).map((d) => (
                  <button
                    key={`res-${d.ymd}`}
                    type="button"
                    onClick={() => setSelectedDate(d.ymd)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                      selectedDate === d.ymd
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#12121A] border border-white/10 text-zinc-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {finishedMatchesAll.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center text-sm text-zinc-400">
                Aucun match terminé enregistré pour cette date. Essayez « Hier ».
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {finishedMatchesAll.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isFavoriteClub={isFavoriteClub}
                    onToggleFavoriteClub={toggleFavoriteClub}
                    onSelectMatch={setSelectedMatch}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. CLASSEMENTS */}
        {activeTab === 'standings' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#12121A] border border-white/8 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Classements officiels
                </h1>
                <p className="text-xs text-zinc-400">
                  Sélectionnez une compétition pour afficher son classement complet.
                </p>
              </div>
              <select
                value={standingsActiveComp?.id || ''}
                onChange={(e) => setStandingsPickerCompId(e.target.value)}
                aria-label="Choisir une compétition pour le classement"
                className="min-h-[44px] px-3.5 rounded-xl bg-[#09090E] border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                {availableCompetitions
                  .filter((c) => c.hasStandings)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.country} — {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {standingsActiveComp ? (
              <StandingsView
                competition={standingsActiveComp}
                onBack={() => handleNavChange('competitions')}
                isFavoriteCompetition={favorites.competitions.includes(standingsActiveComp.id)}
                onToggleFavoriteCompetition={toggleFavoriteCompetition}
                isFavoriteClub={isFavoriteClub}
                onToggleFavoriteClub={toggleFavoriteClub}
                onSelectMatch={setSelectedMatch}
              />
            ) : (
              <p className="text-sm text-zinc-400">Aucune compétition avec classement disponible.</p>
            )}
          </div>
        )}

        {/* 8. CALENDRIER */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Calendrier des matchs à venir ({upcomingMatchesAll.length})
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Horaires convertis dans votre fuseau local · {formatLocalDateFr(selectedDate + 'T12:00:00Z')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {dateShortcuts.slice(1).map((d) => (
                  <button
                    key={`cal-${d.ymd}`}
                    type="button"
                    onClick={() => setSelectedDate(d.ymd)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                      selectedDate === d.ymd
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#12121A] border border-white/10 text-zinc-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  aria-label="Date du calendrier"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#12121A] border border-white/10 text-xs text-zinc-200"
                />
              </div>
            </div>

            {upcomingMatchesAll.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center text-sm text-zinc-400">
                Aucun match à venir programmé pour cette journée. Essayez « Demain » ou choisissez une autre date.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcomingMatchesAll.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isFavoriteClub={isFavoriteClub}
                    onToggleFavoriteClub={toggleFavoriteClub}
                    onSelectMatch={setSelectedMatch}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 9. STATISTIQUES */}
        {activeTab === 'stats' && (
          <StatsExplorerView matches={matches} onOpenMatchModal={setSelectedMatch} />
        )}

        {/* 10. ÉQUIPES */}
        {activeTab === 'teams' && (
          <TeamsDirectoryView
            matches={matches}
            favoriteClubs={favorites.clubs}
            isFavoriteClub={isFavoriteClub}
            onToggleFavoriteClub={toggleFavoriteClub}
            onSelectMatch={setSelectedMatch}
            onSelectPlayer={(player) => {
              setSelectedPlayerForProfile(player);
              handleNavChange('players');
            }}
          />
        )}

        {/* 11. JOUEURS */}
        {activeTab === 'players' && (
          <PlayersDirectoryView
            matches={matches}
            initialSelectedPlayer={selectedPlayerForProfile}
            onClearInitialPlayer={() => setSelectedPlayerForProfile(null)}
          />
        )}

        {/* 12. NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <NotificationsCenterView
            user={firebaseUser}
            authLoading={authLoading}
            cloudSyncedAt={cloudSyncedAt}
            onSignInGoogle={async () => {
              setAuthLoading(true);
              try {
                await signInWithGoogle();
              } finally {
                setAuthLoading(false);
              }
            }}
            onSignOut={async () => {
              setAuthLoading(true);
              try {
                await signOutUser();
              } finally {
                setAuthLoading(false);
              }
            }}
            prefs={notifPrefs}
            onChangePrefs={setNotifPrefs}
            favoriteClubs={favorites.clubs}
            clubNotifPrefs={clubNotifPrefs}
            onChangeClubNotifPrefs={setClubNotifPrefs}
            alertHistory={alertHistory}
            onTriggerTestAlert={() =>
              pushAlert({
                id: `test-${Date.now()}`,
                matchId: 'test',
                kind: 'goal',
                title: 'Alerte DJOUMA FOOT LIVE',
                body: 'Les notifications en direct (buts, cartons, coups d’envoi) sont actives.',
                timestamp: new Date().toISOString(),
              })
            }
            onSaveFcmToken={async (token) => {
              if (firebaseUser) {
                await syncUserPreferencesToFirestore(firebaseUser, favorites, notifPrefs, token);
              }
            }}
          />
        )}
      </main>

      {/* Footer Attribution */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-10 pb-4 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/6 mt-12">
        <span>DJOUMA FOOT LIVE · Créée par Djouma Coulibaly.</span>
        <span>Résultats &amp; statistiques sportives officielles · Zéro pari sportif.</span>
      </footer>

      {/* Mobile Fixed 5-Tab Bottom Navigation Bar (14.2% total sticky height with h-14 header) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#09090E]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center"
      >
        {(
          [
            { id: 'home', label: 'Accueil', icon: Home },
            { id: 'live', label: 'Direct', icon: Radio },
            { id: 'competitions', label: 'Ligues', icon: Trophy },
            { id: 'teams', label: 'Équipes', icon: Shield },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-violet-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowMobileMenuSheet(true)}
          aria-label="Afficher toutes les 12 rubriques"
          className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
            showMobileMenuSheet ? 'text-violet-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Grid className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">Plus</span>
        </button>
      </nav>

      {/* Mobile All-12 Rubriques Bottom Sheet */}
      {showMobileMenuSheet && (
        <div
          className="fixed inset-0 z-50 md:hidden flex items-end bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Toutes les rubriques"
        >
          <div className="w-full rounded-t-3xl bg-[#0F0F16] border-t border-white/12 p-5 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Toutes les rubriques</h2>
              <button
                type="button"
                onClick={() => setShowMobileMenuSheet(false)}
                aria-label="Fermer le menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {all12Sections.map((sec) => {
                const Icon = sec.icon;
                const active = activeTab === sec.id;
                return (
                  <button
                    key={`sheet-${sec.id}`}
                    type="button"
                    onClick={() => handleNavChange(sec.id)}
                    className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl text-left text-xs font-semibold flex items-center gap-2.5 border transition-colors ${
                      active
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-[#151520] border-white/8 text-zinc-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{sec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          isFavoriteClub={isFavoriteClub}
          onToggleFavoriteClub={toggleFavoriteClub}
          bonusUnlocked={isRewardUnlocked(rewardUnlocks, 'tactical-analysis')}
          isOnline={isOnline}
          onRequestRewardedAd={() => setShowRewardedModal(true)}
        />
      )}

      {/* Alerts & About Modal */}
      {showAboutModal && (
        <AboutAndAlertsModal
          onClose={() => setShowAboutModal(false)}
          prefs={notifPrefs}
          onChangePrefs={setNotifPrefs}
          favoriteClubs={favorites.clubs}
          clubNotifPrefs={clubNotifPrefs}
          onChangeClubNotifPrefs={setClubNotifPrefs}
          onTriggerTestAlert={() =>
            pushAlert({
              id: `test-${Date.now()}`,
              matchId: 'test',
              kind: 'goal',
              title: 'Alerte DJOUMA FOOT LIVE',
              body: 'Les notifications en direct (buts, cartons rouges, coups d’envoi) sont opérationnelles.',
              timestamp: new Date().toISOString(),
            })
          }
          providerName={providerName}
          hasApiFootballKey={hasApiFootballKey || sportradarConfigured}
          consentStatus={adConsent}
          onResetConsent={() => {
            setAdConsent('pending');
            setShowAboutModal(false);
          }}
          onTestAppOpen={() => {
            setShowAboutModal(false);
            setShowAppOpenAd(true);
          }}
          onTestInterstitial={() => {
            setShowAboutModal(false);
            setShowInterstitial(true);
          }}
          onTestRewarded={() => {
            setShowAboutModal(false);
            setShowRewardedModal(true);
          }}
        />
      )}

      {/* AdMob Consent & Placements */}
      <AdConsentBanner
        consentStatus={adConsent}
        onSelectConsent={(status) => setAdConsent(status)}
      />

      <AppOpenAdOverlay
        open={showAppOpenAd}
        consentStatus={adConsent}
        onClose={() => setShowAppOpenAd(false)}
      />

      <InterstitialAdOverlay
        open={showInterstitial}
        consentStatus={adConsent}
        onClose={() => setShowInterstitial(false)}
      />

      <RewardedAdModal
        open={showRewardedModal}
        onCancel={() => setShowRewardedModal(false)}
        onRewardEarned={() => {
          setRewardUnlocks((prev) => grantRewardUnlock(prev, 'tactical-analysis'));
          setShowRewardedModal(false);
          pushAlert({
            id: `reward-${Date.now()}`,
            matchId: 'reward',
            kind: 'goal',
            title: 'Contenu bonus débloqué (24h)',
            body: "L'analyse tactique avancée est désormais accessible dans les statistiques de vos matchs.",
            timestamp: new Date().toISOString(),
          });
        }}
      />
    </div>
  );
}

const NewsCard: React.FC<{ article: NewsArticle }> = ({ article }) => {
  const [imgSrc, setImgSrc] = useState(article.imageUrl || STADIUM_FALLBACK_SRC);

  return (
    <article className="rounded-2xl bg-[#12121A] border border-white/8 hover:border-violet-500/35 overflow-hidden flex flex-col transition-colors">
      <div className="aspect-[16/9] w-full bg-zinc-900 overflow-hidden">
        <img
          src={imgSrc}
          alt={article.title}
          referrerPolicy="no-referrer"
          onError={() => setImgSrc(STADIUM_FALLBACK_SRC)}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{article.league || 'Football'}</span>
            <span aria-hidden="true">·</span>
            <span>{formatLocalDateFr(article.publishedAt)}</span>
          </div>
          <h3 className="text-base font-semibold text-white leading-snug line-clamp-2">
            {article.title}
          </h3>
          {article.summary && (
            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
              {article.summary}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-white/6 flex items-center justify-between text-xs">
          <span className="text-zinc-500">{article.source}</span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-violet-400 hover:text-violet-300 font-medium"
          >
            Lire la source
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
};
