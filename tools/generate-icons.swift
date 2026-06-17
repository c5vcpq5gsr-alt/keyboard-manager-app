import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct IconSize {
  let name: String
  let pixels: Int
}

let sizes = [
  IconSize(name: "icon_16x16.png", pixels: 16),
  IconSize(name: "icon_16x16@2x.png", pixels: 32),
  IconSize(name: "icon_32x32.png", pixels: 32),
  IconSize(name: "icon_32x32@2x.png", pixels: 64),
  IconSize(name: "icon_128x128.png", pixels: 128),
  IconSize(name: "icon_128x128@2x.png", pixels: 256),
  IconSize(name: "icon_256x256.png", pixels: 256),
  IconSize(name: "icon_256x256@2x.png", pixels: 512),
  IconSize(name: "icon_512x512.png", pixels: 512),
  IconSize(name: "icon_512x512@2x.png", pixels: 1024),
]

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data((message + "\n").utf8))
  exit(1)
}

guard CommandLine.arguments.count == 3 else {
  fail("Usage: swift tools/generate-icons.swift <source-png> <project-root>")
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let rootURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let assetsURL = rootURL.appendingPathComponent("assets", isDirectory: true)
let iconsetURL = assetsURL.appendingPathComponent("app-icon.iconset", isDirectory: true)
let sourceCopyURL = assetsURL.appendingPathComponent("app-icon-source.png")
let previewURL = assetsURL.appendingPathComponent("app-icon-1024.png")

let fileManager = FileManager.default
try fileManager.createDirectory(at: iconsetURL, withIntermediateDirectories: true)

if sourceURL.standardizedFileURL.path != sourceCopyURL.standardizedFileURL.path {
  if fileManager.fileExists(atPath: sourceCopyURL.path) {
    try fileManager.removeItem(at: sourceCopyURL)
  }
  try fileManager.copyItem(at: sourceURL, to: sourceCopyURL)
}

guard let image = NSImage(contentsOf: sourceURL),
      let sourceCG = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
  fail("Could not read source image: \(sourceURL.path)")
}

let width = sourceCG.width
let height = sourceCG.height
let bytesPerPixel = 4
let bytesPerRow = width * bytesPerPixel
var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
let colorSpace = CGColorSpaceCreateDeviceRGB()

guard let readContext = CGContext(
  data: &pixels,
  width: width,
  height: height,
  bitsPerComponent: 8,
  bytesPerRow: bytesPerRow,
  space: colorSpace,
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fail("Could not create source bitmap context")
}

readContext.draw(sourceCG, in: CGRect(x: 0, y: 0, width: width, height: height))

var minX = width
var minY = height
var maxX = 0
var maxY = 0
let threshold = UInt8(10)

for y in 0..<height {
  for x in 0..<width {
    let offset = y * bytesPerRow + x * bytesPerPixel
    let r = pixels[offset]
    let g = pixels[offset + 1]
    let b = pixels[offset + 2]
    if max(r, max(g, b)) > threshold {
      minX = min(minX, x)
      minY = min(minY, y)
      maxX = max(maxX, x)
      maxY = max(maxY, y)
    }
  }
}

if minX > maxX || minY > maxY {
  fail("Could not detect non-background icon content")
}

let padding = 16
let contentWidth = maxX - minX + 1
let contentHeight = maxY - minY + 1
let side = min(max(contentWidth, contentHeight) + padding * 2, min(width, height))
let centerX = (minX + maxX) / 2
let centerY = (minY + maxY) / 2
let cropX = max(0, min(width - side, centerX - side / 2))
let cropY = max(0, min(height - side, centerY - side / 2))

guard let croppedCG = sourceCG.cropping(to: CGRect(x: cropX, y: cropY, width: side, height: side)) else {
  fail("Could not crop source image")
}

func renderIcon(size: Int) -> CGImage {
  let data = NSMutableData(length: size * size * bytesPerPixel)!
  guard let context = CGContext(
    data: data.mutableBytes,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: size * bytesPerPixel,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    fail("Could not create render context for \(size)x\(size)")
  }

  context.clear(CGRect(x: 0, y: 0, width: size, height: size))
  context.interpolationQuality = .high

  let rect = CGRect(x: 0, y: 0, width: size, height: size)
  let radius = CGFloat(size) * 0.205
  let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
  context.addPath(path)
  context.clip()
  context.draw(croppedCG, in: rect)

  guard let output = context.makeImage() else {
    fail("Could not render icon image")
  }
  return output
}

func writePNG(_ image: CGImage, to url: URL) {
  guard let destination = CGImageDestinationCreateWithURL(
    url as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
  ) else {
    fail("Could not create PNG destination: \(url.path)")
  }

  CGImageDestinationAddImage(destination, image, nil)
  if !CGImageDestinationFinalize(destination) {
    fail("Could not write PNG: \(url.path)")
  }
}

for size in sizes {
  writePNG(renderIcon(size: size.pixels), to: iconsetURL.appendingPathComponent(size.name))
}

writePNG(renderIcon(size: 1024), to: previewURL)
print("Generated \(iconsetURL.path)")
print("Generated \(previewURL.path)")
