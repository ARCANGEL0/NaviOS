import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';

class NaviSessionStore {
  static const _key = 'navi_mobile_sessions_v1';

  static Future<List<NaviSession>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .whereType<Map>()
          .map((item) => NaviSession.fromJson(Map<String, dynamic>.from(item)))
          .toList();
    } on FormatException {
      return [];
    } on TypeError {
      return [];
    }
  }

  static Future<void> save(List<NaviSession> sessions) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, encodeSessions(sessions));
  }
}
