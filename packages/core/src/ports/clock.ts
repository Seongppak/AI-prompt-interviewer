export interface Clock {
  now(): Date
}

export interface IdGenerator {
  generate(): string
}
