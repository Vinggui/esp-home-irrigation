import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Format data for ESP32
    const esp32Data = {
      command: "update_schedule",
      zones: data.zones.map((zone: any) => ({
        id: zone.id,
        name: zone.name,
        flow_rate: zone.flowRate || 10,
        schedules:
          zone.schedules?.map((schedule: any) => ({
            id: schedule.id,
            enabled: schedule.enabled,
            start_hour: Number.parseInt(schedule.startTime.split(":")[0]),
            start_minute: Number.parseInt(schedule.startTime.split(":")[1]),
            duration_minutes: schedule.duration,
            adjusted_duration_minutes: schedule.adjustedDuration || schedule.duration,
            days_mask: schedule.days.reduce((mask: number, day: string) => {
              const dayIndex = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(day)
              return mask | (1 << dayIndex)
            }, 0),
          })) || [],
      })),
      seasonal_settings: data.seasonalSettings,
      current_season: data.currentSeason,
    }

    console.log("Schedule data formatted for ESP32:", esp32Data)

    return NextResponse.json({
      success: true,
      message: "Schedule updated successfully",
      esp32_data: esp32Data,
    })
  } catch (error) {
    console.error("Schedule update error:", error)
    return NextResponse.json({ success: false, error: "Failed to update schedule" }, { status: 500 })
  }
}
