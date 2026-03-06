import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getAccessToken } from "@/lib/api";
import { getMyAgencyMembership, type AgencyMembership } from "@/lib/agencyTeam";

type VolunteerAgencyValue = {
  membership: AgencyMembership | null;
};

const VolunteerAgencyContext = createContext<VolunteerAgencyValue>({ membership: null });

export function useVolunteerAgency(): VolunteerAgencyValue {
  return useContext(VolunteerAgencyContext);
}

export function VolunteerAgencyProvider({ children }: { children: ReactNode }) {
  const [membership, setMembership] = useState<AgencyMembership | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    getMyAgencyMembership()
      .then((m) => {
        if (!cancelled) setMembership(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <VolunteerAgencyContext.Provider value={{ membership }}>
      {children}
    </VolunteerAgencyContext.Provider>
  );
}
