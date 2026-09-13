export type VehicleStatus = "active" | "maintenance" | "retired";
export type RouteStatus = "active" | "paused" | "ended";
export type DeliveryStatus = "scheduled" | "in_transit" | "delivered" | "failed";

export interface Vehicle {
  id: string;
  name: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  vin: string | null;
  status: VehicleStatus;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  client_name: string;
  runs_per_day: number;
  status: RouteStatus;
  created_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  store_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sequence_order: number;
  created_at: string;
}

export interface RouteAssignment {
  id: string;
  route_id: string;
  vehicle_id: string;
  is_active: boolean;
  assigned_at: string;
  unassigned_at: string | null;
}

export interface RouteWithDetails extends Route {
  route_stops: RouteStop[];
  route_assignments: (RouteAssignment & { vehicles: Vehicle | null })[];
}
