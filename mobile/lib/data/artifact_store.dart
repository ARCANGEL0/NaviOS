import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';

class NaviArtifactStore {
  static const _key = 'navi_mobile_artifacts_v1';

  static Future<List<NaviArtifact>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    try {
      final entries = (jsonDecode(raw) as List)
          .whereType<Map>()
          .map((item) => NaviArtifact.fromJson(Map<String, dynamic>.from(item)))
          .toList();
      final available = <NaviArtifact>[];
      for (final artifact in entries) {
        if (await File(artifact.localPath).exists()) available.add(artifact);
      }
      return available;
    } on FormatException {
      return [];
    } on TypeError {
      return [];
    }
  }

  static Future<void> save(List<NaviArtifact> artifacts) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(artifacts.map((artifact) => artifact.toJson()).toList()),
    );
  }
}
