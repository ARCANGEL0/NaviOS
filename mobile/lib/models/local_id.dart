String newLocalId() =>
    '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}'
    '${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
