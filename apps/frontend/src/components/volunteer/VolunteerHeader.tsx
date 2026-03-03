import { getAccessToken, getCurrentUser } from "../../lib/api";
import { ApplyForVolunteer } from "./ApplyForVolunteer";

export function VolunteerHeader() {
  const isSignedInVolunteer = !!getAccessToken() && !!getCurrentUser()?.hasVolunteerProfile;

  return (
    <header className="w-full bg-gray-900 px-6 py-4 flex items-center justify-end border-b border-gray-800 shrink-0">
      {!isSignedInVolunteer && <ApplyForVolunteer asLink />}
    </header>
  );
}
