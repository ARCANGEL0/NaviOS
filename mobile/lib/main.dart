import 'package:flutter/material.dart';

import 'screens/navi_web_home.dart';

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
      home: const NaviWebHome(),
    );
  }
}
