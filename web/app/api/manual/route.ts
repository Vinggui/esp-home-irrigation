import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Format data for ESP32
    const esp32Data = {
      command: "manual_control",
      zone: data.zone,
      active: data.active,
      duration_minutes: data.duration,
      flow_rate: data.flowRate || 10,
      estimated_volume: data.active ? data.duration * (data.flowRate || 10) : 0,
    }

    console.log("Manual control data formatted for ESP32:", esp32Data)

    return NextResponse.json({
      success: true,
      message: `Zone ${data.zone} ${data.active ? "activated" : "deactivated"}`,
      esp32_data: esp32Data,
    })
  } catch (error) {
    console.error("Manual control error:", error)
    return NextResponse.json({ success: false, error: "Failed to control zone" }, { status: 500 })
  }
}
