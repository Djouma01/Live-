import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  /// URL du backend securise Express (/api/*) - aucune cle API secrete dans le code Android.
  final String baseUrl;

  ApiClient({required this.baseUrl});

  Future<Map<String, dynamic>> getMatches({required String dateYmd, String competition = 'all'}) async {
    final uri = Uri.parse('$baseUrl/api/matches?date=$dateYmd&competition=$competition');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode == 429) {
      throw Exception('Limite de requetes API atteinte. Veuillez patienter.');
    }
    if (res.statusCode != 200) {
      throw Exception('Erreur serveur (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getMatchDetail(String competitionId, String matchId) async {
    final uri = Uri.parse('$baseUrl/api/matches/$competitionId/$matchId');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Details du match indisponibles (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getStandings(String competitionId) async {
    final uri = Uri.parse('$baseUrl/api/standings/$competitionId');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Classement indisponible (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getCompetitions() async {
    final uri = Uri.parse('$baseUrl/api/competitions');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Competitions indisponibles (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getCountries() async {
    final uri = Uri.parse('$baseUrl/api/countries');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Pays indisponibles (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getTeamDetail(String competitionId, String teamId) async {
    final uri = Uri.parse(
      '$baseUrl/api/teams/${Uri.encodeComponent(competitionId)}/${Uri.encodeComponent(teamId)}',
    );
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Fiche equipe indisponible (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getPlayerProfile(String playerId) async {
    final uri = Uri.parse('$baseUrl/api/players/${Uri.encodeComponent(playerId)}');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Fiche joueur indisponible (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getNews() async {
    final uri = Uri.parse('$baseUrl/api/news');
    final res = await http.get(uri).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) {
      throw Exception('Actualites indisponibles (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
