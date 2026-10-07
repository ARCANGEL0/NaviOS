"use client"

import {
  createFrameCornersSettings,
  createFrameKranoxSettings,
  createFrameLinesSettings,
  createFrameNefrexSettings,
  createFrameUnderlineSettings,
  createFrameOctagonSettings
} from "@/components/ui/navi_fx"

export const navi_under_1 = createFrameUnderlineSettings({
  styled: true,
  animated: true,
  squareSize: 14,
  strokeWidth: 1,
})


export const navi_octagon_1 = createFrameOctagonSettings({

  styled: true,
  animated: true,
  padding: 10,
    leftTop: false,
    rightBottom: false,
    squareSize: 70,
    strokeWidth: 2
})


 
export const navi_card_1 = createFrameNefrexSettings({
  styled: true,
  animated: true,
  leftTop: false,
  leftBottom: true,
  rightTop: true,
  rightBottom: false,
  squareSize: 14,
  strokeWidth: 1,
  smallLineLength: 14,
  largeLineLength: 54,
})

export const navi_ctrl_1 = createFrameNefrexSettings({
  styled: true,
  animated: true,
  leftTop: false,
  leftBottom: true,
  rightTop: true,
  rightBottom: false,
  squareSize: 14,
  strokeWidth: 1,
  smallLineLength: 14,
  largeLineLength: 54,
})

export const navi_panel_1 = createFrameNefrexSettings({
  styled: true,
  animated: true,
  leftTop: false,
  leftBottom: true,
  rightTop: true,
  rightBottom: false,
  squareSize: 14,
  strokeWidth: 1,
  smallLineLength: 14,
  largeLineLength: 54,
})

export const navi_field_1 = createFrameCornersSettings({
  styled: true,
  animated: true,
  strokeWidth: 1,
})

export const navi_field_2 = createFrameNefrexSettings({
  styled: true,
  animated: true,
  leftTop: true,
  leftBottom: true,
  rightTop: true,
  rightBottom: true,
  squareSize: 10,
  strokeWidth: 1,
  smallLineLength: 12,
  largeLineLength: 36,
})

export const navi_kranox_1 = createFrameKranoxSettings({
  styled: true,
  animated: true,
  strokeWidth: 1,
  bgStrokeWidth: 1,
  squareSize: 12,
  smallLineLength: 10,
  largeLineLength: 30,
})

export const navi_lines_1 = createFrameLinesSettings({
  styled: true,
  animated: true,
  padding: 4,
  largeLineWidth: 18,
  smallLineWidth: 8,
  smallLineLength: 18,
})
