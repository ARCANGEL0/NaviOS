import 'package:flutter/material.dart';

class WebLoadStatus extends StatelessWidget {
  const WebLoadStatus({
    super.key,
    required this.loading,
    required this.failed,
    required this.progress,
    required this.onRetry,
  });

  final bool loading;
  final bool failed;
  final int progress;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      if (loading)
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: LinearProgressIndicator(
            value: progress == 0 ? null : progress / 100,
            minHeight: 2,
            backgroundColor: const Color(0xFF26141B),
            color: const Color(0xFFEA6282),
          ),
        ),
      if (failed)
        Positioned.fill(
          child: ColoredBox(
            color: const Color(0xFF090608),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'NAVI // LINK LOST',
                    style: TextStyle(
                      color: Color(0xFFEA6282),
                      fontFamily: 'monospace',
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 18),
                  OutlinedButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('RETRY'),
                  ),
                ],
              ),
            ),
          ),
        ),
    ],
  );
}
