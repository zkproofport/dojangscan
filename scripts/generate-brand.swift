// Run from the repository root on macOS:
// swift -module-cache-path /private/tmp/dojangscan-swift-cache scripts/generate-brand.swift
// No font files are embedded: all exported lettering is outlined.
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

struct Shape { let path: CGPath; let color: String }
let output = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("public/brand")
func color(_ hex: String) -> CGColor {
    let value = UInt32(hex.replacingOccurrences(of: "#", with: ""), radix: 16)!
    return CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [CGFloat((value >> 16) & 255) / 255, CGFloat((value >> 8) & 255) / 255, CGFloat(value & 255) / 255, 1])!
}
func text(_ value: String, x: CGFloat, y: CGFloat, size: CGFloat, fill: String, medium: Bool = false) -> (Shape, CGFloat) {
    let font = CTFontCreateWithName((medium ? "HelveticaNeue-Medium" : "HelveticaNeue") as CFString, size, nil)
    let string = NSAttributedString(string: value, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
    let line = CTLineCreateWithAttributedString(string)
    let path = CGMutablePath()
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        let count = CTRunGetGlyphCount(run)
        var glyphs = [CGGlyph](repeating: 0, count: count)
        var positions = [CGPoint](repeating: .zero, count: count)
        CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
        CTRunGetPositions(run, CFRange(location: 0, length: 0), &positions)
        for i in 0..<count {
            if let glyph = CTFontCreatePathForGlyph(font, glyphs[i], nil) {
                path.addPath(glyph, transform: CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: x + positions[i].x, ty: y - positions[i].y))
            }
        }
    }
    return (Shape(path: path, color: fill), CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil)))
}
func stamp(_ fill: String, x: CGFloat = 0, y: CGFloat = 0, scale: CGFloat = 1) -> Shape {
    let p = CGMutablePath()
    p.move(to: CGPoint(x: 22, y: 32)); p.addLine(to: CGPoint(x: 22, y: 16))
    p.addCurve(to: CGPoint(x: 32, y: 6), control1: CGPoint(x: 22, y: 10.47715), control2: CGPoint(x: 26.47715, y: 6))
    p.addCurve(to: CGPoint(x: 42, y: 16), control1: CGPoint(x: 37.52285, y: 6), control2: CGPoint(x: 42, y: 10.47715))
    for point in [CGPoint(x:42,y:32),CGPoint(x:54,y:44),CGPoint(x:54,y:48),CGPoint(x:10,y:48),CGPoint(x:10,y:44)] { p.addLine(to: point) }; p.closeSubpath()
    p.move(to: CGPoint(x: 10, y: 51)); p.addQuadCurve(to: CGPoint(x:54,y:51), control: CGPoint(x:32,y:61)); p.addLine(to: CGPoint(x:51,y:57)); p.addQuadCurve(to: CGPoint(x:13,y:57), control: CGPoint(x:32,y:65)); p.closeSubpath()
    var transform = CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: x, ty: y)
    return Shape(path: p.copy(using: &transform)!, color: fill)
}
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: String) -> Shape {
    Shape(path: CGPath(rect: CGRect(x:x,y:y,width:w,height:h), transform:nil), color:fill)
}
func svgPath(_ p: CGPath) -> String {
    var result = ""
    func pt(_ p: CGPoint) -> String { String(format:"%.3f %.3f", Double(p.x), Double(p.y)) }
    p.applyWithBlock { entry in
        let e = entry.pointee
        switch e.type {
        case .moveToPoint: result += "M" + pt(e.points[0])
        case .addLineToPoint: result += "L" + pt(e.points[0])
        case .addQuadCurveToPoint: result += "Q" + pt(e.points[0]) + " " + pt(e.points[1])
        case .addCurveToPoint: result += "C" + pt(e.points[0]) + " " + pt(e.points[1]) + " " + pt(e.points[2])
        case .closeSubpath: result += "Z"
        @unknown default: break
        }
    }
    return result
}
func save(_ name: String, width: Int, height: Int, shapes: [Shape], scale: Int = 1) throws {
    let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(width)\" height=\"\(height)\" viewBox=\"0 0 \(width) \(height)\"><title>Dojangscan</title>" + shapes.map { "<path fill=\"\($0.color)\" d=\"\(svgPath($0.path))\"/>" }.joined() + "</svg>\n"
    try svg.write(to: output.appendingPathComponent(name + ".svg"), atomically: true, encoding: .utf8)
    let ctx = CGContext(data:nil,width:width*scale,height:height*scale,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.translateBy(x:0,y:CGFloat(height*scale));ctx.scaleBy(x:CGFloat(scale),y:-CGFloat(scale))
    for shape in shapes { ctx.setFillColor(color(shape.color));ctx.addPath(shape.path);ctx.fillPath() }
    let destination = CGImageDestinationCreateWithURL(output.appendingPathComponent(name + ".png") as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination,ctx.makeImage()!,nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("PNG export failed") }
}
for (variant,ink,accent) in [("light","#1D1D1F","#B84536"),("dark","#F5F5F7","#F29280"),("black","#000000","#000000"),("white","#FFFFFF","#FFFFFF")] {
    try save("dojangscan-symbol-"+variant,width:64,height:64,shapes:[stamp(accent)],scale:8)
    let wordmark = text("Dojangscan",x:104,y:82,size:56,fill:ink,medium:true)
    try save("dojangscan-wordmark-"+variant,width:Int(ceil(128+wordmark.1)),height:128,shapes:[stamp(accent,x:16,y:32),wordmark.0],scale:3)
}
func cover(width: Int, height: Int, name: String) throws {
    let w = CGFloat(width), h = CGFloat(height)
    let wordmark = text("Dojangscan",x:80,y:h*0.49,size:92,fill:"#1D1D1F",medium:true)
    let network = text("GIWA SEPOLIA",x:0,y:0,size:18,fill:"#6E6E73",medium:true)
    let domain = text("dojangscan.com",x:0,y:0,size:22,fill:"#6E6E73")
    let shapes = [rect(0,0,w,h,"#F5F5F7"),stamp("#B84536",x:64,y:62,scale:1.5),wordmark.0,
        text("GIWA SEPOLIA",x:w-80-network.1,y:108,size:18,fill:"#6E6E73",medium:true).0,
        text("Explore and manage GIWA attestations.",x:84,y:h*0.49+64,size:30,fill:"#6E6E73").0,
        rect(84,h-150,w-168,1,"#DEDEE2"),text("Powered by Masse Labs",x:84,y:h-88,size:24,fill:"#1D1D1F",medium:true).0,
        text("dojangscan.com",x:w-84-domain.1,y:h-88,size:22,fill:"#6E6E73").0]
    try save(name,width:width,height:height,shapes:shapes)
}
try cover(width:1280,height:720,name:"dojangscan-cover")
try cover(width:1200,height:630,name:"dojangscan-social")
let root = output.deletingLastPathComponent().deletingLastPathComponent()
for name in ["dojangscan-v2.png", "dojang-scan-v1.png"] {
    try Data(contentsOf: output.appendingPathComponent("dojangscan-social.png")).write(to: root.appendingPathComponent("public/social/" + name))
}
try Data(contentsOf: output.appendingPathComponent("dojangscan-social.svg")).write(to: root.appendingPathComponent("design/social-card.svg"))
let files = try FileManager.default.contentsOfDirectory(at: output, includingPropertiesForKeys:nil).filter {
    ($0.lastPathComponent.hasPrefix("dojangscan-") && !$0.lastPathComponent.contains("social") && ["svg","png"].contains($0.pathExtension)) || $0.lastPathComponent == "brand-guidelines.txt"
}.sorted { $0.lastPathComponent < $1.lastPathComponent }
let archive = FileManager.default.temporaryDirectory.appendingPathComponent("dojangscan-" + UUID().uuidString + ".zip")
let zip = Process(); zip.executableURL = URL(fileURLWithPath:"/usr/bin/zip")
zip.arguments = ["-j", "-q", archive.path] + files.map { $0.path }
try zip.run(); zip.waitUntilExit()
guard zip.terminationStatus == 0 else { fatalError("ZIP export failed") }
try Data(contentsOf:archive).write(to:output.appendingPathComponent("dojangscan-brand-kit.zip"))
try FileManager.default.removeItem(at:archive)
print("Exported outlined SVGs, PNGs, social previews and ZIP to public/brand")
