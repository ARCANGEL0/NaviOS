import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../widgets/web_load_status.dart';

class NaviWebHome extends StatefulWidget {
  const NaviWebHome({super.key});

  @override
  State<NaviWebHome> createState() => _NaviWebHomeState();
}

class _NaviWebHomeState extends State<NaviWebHome> {
  static final _siteUri = WebUri('https://navi.arcangelo.net');

  InAppWebViewController? _controller;
  int _progress = 0;
  bool _loading = true;
  bool _failed = false;

  void _retry() {
    setState(() {
      _failed = false;
      _loading = true;
      _progress = 0;
    });
    _controller?.loadUrl(urlRequest: URLRequest(url: _siteUri));
  }

  Future<void> _goBack() async {
    final controller = _controller;
    if (controller != null && await controller.canGoBack()) {
      await controller.goBack();
      return;
    }
    await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goBack();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF090608),
        body: SafeArea(
          top: false,
          bottom: false,
          child: Stack(
            children: [
              InAppWebView(
                initialUrlRequest: URLRequest(url: _siteUri),
                initialSettings: InAppWebViewSettings(
                  javaScriptEnabled: true,
                  domStorageEnabled: true,
                  databaseEnabled: true,
                  supportZoom: false,
                  useWideViewPort: true,
                  loadWithOverviewMode: false,
                  mediaPlaybackRequiresUserGesture: true,
                  allowsInlineMediaPlayback: true,
                ),
                onWebViewCreated: (controller) => _controller = controller,
                onLoadStart: (_, _) {
                  if (!mounted) return;
                  setState(() {
                    _loading = true;
                    _failed = false;
                  });
                },
                onProgressChanged: (_, progress) {
                  if (mounted) setState(() => _progress = progress);
                },
                onLoadStop: (_, _) {
                  if (!mounted) return;
                  setState(() {
                    _loading = false;
                    _failed = false;
                  });
                },
                onReceivedError: (_, request, _) {
                  if (request.isForMainFrame == false || !mounted) return;
                  setState(() {
                    _loading = false;
                    _failed = true;
                  });
                },
              ),
              WebLoadStatus(
                loading: _loading,
                failed: _failed,
                progress: _progress,
                onRetry: _retry,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
