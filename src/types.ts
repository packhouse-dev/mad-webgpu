export interface MapRule {
  type: string;
  // We can add more properties here as needed
}

export interface MatchConfig {
  match: {
    time: number;
    maxPlayers: number;
  };
  map: {
    rules: MapRule[];
    size: [number, number];
  };
}
