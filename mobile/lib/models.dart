import 'dart:convert';

import 'models/navi_session.dart';

export 'models/local_id.dart';
export 'models/navi_artifact.dart';
export 'models/navi_message.dart';
export 'models/navi_session.dart';

String encodeSessions(List<NaviSession> sessions) =>
    jsonEncode(sessions.map((session) => session.toJson()).toList());
