import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIncident,
  getIncidentCategories,
  getNearbyIncidentsFiltered,
  type NearbyIncidentsResult,
} from "./incidents";
import { getVolunteerSummary, type VolunteerSummary } from "./dashboard";

const DEFAULT_STALE_MS = 60 * 1000;

export function useIncident(incidentId: string | null, options?: { signal?: AbortSignal }) {
  return useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => getIncident(incidentId!, { signal: options?.signal }),
    enabled: !!incidentId,
    staleTime: DEFAULT_STALE_MS,
  });
}

export function useIncidentCategories() {
  return useQuery({
    queryKey: ["incidentCategories"],
    queryFn: getIncidentCategories,
    staleTime: 5 * 60 * 1000,
  });
}

export type NearbyParams = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  perPage?: number;
  agencyId?: string | null;
};

export function useNearbyIncidentsFiltered(params: NearbyParams & { enabled?: boolean }) {
  const { enabled = true, ...rest } = params;
  const queryParams = {
    lat: rest.lat,
    lng: rest.lng,
    radiusKm: rest.radiusKm,
    perPage: rest.perPage,
    agencyId: rest.agencyId ?? undefined,
  };
  return useQuery({
    queryKey: ["nearbyIncidentsFiltered", queryParams],
    queryFn: (): Promise<NearbyIncidentsResult> =>
      getNearbyIncidentsFiltered(queryParams),
    enabled,
    staleTime: DEFAULT_STALE_MS,
  });
}

export function useVolunteerSummary(period = "30d") {
  return useQuery({
    queryKey: ["volunteerSummary", period],
    queryFn: (): Promise<VolunteerSummary> => getVolunteerSummary(period),
    staleTime: DEFAULT_STALE_MS,
  });
}

export function useInvalidateNearbyIncidents() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({ queryKey: ["nearbyIncidentsFiltered"] });
}
