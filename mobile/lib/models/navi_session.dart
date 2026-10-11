import 'local_id.dart';
import 'navi_message.dart';

class NaviSession {
  const NaviSession({
    required this.id,
    required this.title,
    required this.messages,
    required this.updatedAt,
    this.dark = false,
  });

  final String id;
  final String title;
  final List<NaviMessage> messages;
  final DateTime updatedAt;
  final bool dark;

  NaviSession copyWith({
    String? title,
    List<NaviMessage>? messages,
    DateTime? updatedAt,
    bool? dark,
  }) => NaviSession(
    id: id,
    title: title ?? this.title,
    messages: messages ?? this.messages,
    updatedAt: updatedAt ?? this.updatedAt,
    dark: dark ?? this.dark,
  );

  Map<String, Object?> toJson() => {
    'id': id,
    'title': title,
    'messages': messages.map((message) => message.toJson()).toList(),
    'updatedAt': updatedAt.toIso8601String(),
    'dark': dark,
  };

  factory NaviSession.fromJson(Map<String, dynamic> json) => NaviSession(
    id: json['id'] as String? ?? newLocalId(),
    title: json['title'] as String? ?? 'New session',
    messages: (json['messages'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (message) => NaviMessage.fromJson(Map<String, dynamic>.from(message)),
        )
        .toList(),
    updatedAt:
        DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now(),
    dark: json['dark'] as bool? ?? false,
  );
}
