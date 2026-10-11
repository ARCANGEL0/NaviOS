import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_3d_controller/flutter_3d_controller.dart';

import '../models.dart';

class _LocalObjServer {
  static HttpServer? _server;
  static final Map<String, File> _files = {};

  static Future<Uri> expose(File file) async {
    _server ??= await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server!.listen((request) async {
      final segments = request.uri.pathSegments;
      final name = segments.isEmpty ? '' : Uri.decodeComponent(segments.last);
      final requested = _files[name];
      if (requested == null || !await requested.exists()) {
        request.response.statusCode = HttpStatus.notFound;
        await request.response.close();
        return;
      }
      request.response.headers
        ..set(HttpHeaders.contentTypeHeader, 'text/plain; charset=utf-8')
        ..set('Access-Control-Allow-Origin', '*');
      await request.response.addStream(requested.openRead());
      await request.response.close();
    });
    final name = file.path.replaceAll('\\', '/').split('/').last;
    _files[name] = file;
    return Uri(
      scheme: 'http',
      host: 'localhost',
      port: _server!.port,
      path: '/$name',
    );
  }
}

class ModelPreview extends StatefulWidget {
  const ModelPreview({super.key, required this.artifact});

  final NaviArtifact artifact;

  @override
  State<ModelPreview> createState() => _ModelPreviewState();
}

class _ModelPreviewState extends State<ModelPreview> {
  String? _objUrl;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  @override
  void didUpdateWidget(covariant ModelPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.artifact.id != widget.artifact.id) {
      _prepare();
    }
  }

  Future<void> _prepare() async {
    _error = null;
    _objUrl = null;
    if (widget.artifact.format != 'obj') {
      if (mounted) {
        setState(() {});
      }
      return;
    }
    try {
      final uri = await _LocalObjServer.expose(File(widget.artifact.localPath));
      if (mounted) {
        setState(() => _objUrl = uri.toString());
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'The local model could not be opened.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.artifact.format == 'fbx') {
      return const _PreviewNotice(
        icon: Icons.inventory_2_outlined,
        title: 'FBX STORED LOCALLY',
        detail: 'This mobile renderer previews GLB and OBJ files.',
      );
    }
    if (_error != null) {
      return _PreviewNotice(
        icon: Icons.link_off,
        title: 'MODEL PREVIEW FAILED',
        detail: _error!,
      );
    }
    if (widget.artifact.format == 'obj' && _objUrl == null) {
      return const Center(
        child: CircularProgressIndicator(
          color: Color(0xFFE35B7A),
          strokeWidth: 1.5,
        ),
      );
    }
    final src = widget.artifact.format == 'obj'
        ? _objUrl!
        : Uri.file(widget.artifact.localPath).toString();
    return ColoredBox(
      color: const Color(0xFF080709),
      child: widget.artifact.format == 'obj'
          ? Flutter3DViewer.obj(
              key: ValueKey(widget.artifact.id),
              src: src,
              scale: 5,
              cameraZ: 10,
              onError: (message) {
                if (mounted) {
                  setState(
                    () => _error = 'The OBJ model could not be rendered.',
                  );
                }
              },
            )
          : Flutter3DViewer(
              key: ValueKey(widget.artifact.id),
              src: src,
              progressBarColor: const Color(0xFFE35B7A),
              onError: (message) {
                if (mounted) {
                  setState(
                    () => _error = 'The GLB model could not be rendered.',
                  );
                }
              },
            ),
    );
  }
}

class _PreviewNotice extends StatelessWidget {
  const _PreviewNotice({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: const Color(0xFFE35B7A), size: 30),
          const SizedBox(height: 14),
          Text(title, style: const TextStyle(letterSpacing: 1.4, fontSize: 12)),
          const SizedBox(height: 8),
          Text(
            detail,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF9A858C), fontSize: 12),
          ),
        ],
      ),
    ),
  );
}
