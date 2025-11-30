export interface DailySchedule {
    id: string
    enabled: boolean
    startTime: string
    duration: number
    days: string[]
}

export interface SeasonalSettings {
    enabled: boolean
    spring: { multiplier: number; months: number[] }
    summer: { multiplier: number; months: number[] }
    fall: { multiplier: number; months: number[] }
    winter: { multiplier: number; months: number[] }
}