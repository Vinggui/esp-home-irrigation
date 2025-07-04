import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Format usage data for ESP32
    const esp32Data = {
      command: "record_usage",
      zone: data.zone,
      duration_minutes: data.duration,
      volume_liters: data.volume,
      timestamp: new Date().toISOString(),
    }

    console.log("Usage data formatted for ESP32:", esp32Data)

    // In a real implementation, you would send this to your ESP32
    // and possibly store in a database
    return NextResponse.json({
      success: true,
      message: "Usage recorded successfully",
      esp32_data: esp32Data,
    })
  } catch (error) {
    console.error("Usage recording error:", error)
    return NextResponse.json({ success: false, error: "Failed to record usage" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const zone = searchParams.get("zone")
    const period = searchParams.get("period") || "week"

    // In a real implementation, you would fetch this from your database
    // For now, return mock data
    const mockUsageData = {
      zone: zone ? Number.parseInt(zone) : null,
      period,
      data: [
        { date: "2024-01-01", volume: 150, cost: 0.75 },
        { date: "2024-01-02", volume: 120, cost: 0.6 },
        { date: "2024-01-03", volume: 180, cost: 0.9 },
      ],
    }

    return NextResponse.json({
      success: true,
      usage_data: mockUsageData,
    })
  } catch (error) {
    console.error("Usage fetch error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch usage data" }, { status: 500 })
  }
}
