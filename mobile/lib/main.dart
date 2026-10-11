import 'package:flutter/material.dart';

void main() {
  runApp(const NaviMobileApp());
}

class NaviMobileApp extends StatelessWidget {
  const NaviMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NAVI',
      debugShowCheckedModeBanner: false,
      home: const Scaffold(
        backgroundColor: Color(0xFF090608),
        body: Center(
          child: Text(
            'NAVI MOBILE',
            style: TextStyle(
              color: Color(0xFFEA6282),
              fontFamily: 'monospace',
              letterSpacing: 2,
            ),
          ),
        ),
      ),
    );
  }
}
