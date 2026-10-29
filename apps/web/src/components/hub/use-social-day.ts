import { useEffect, useState } from "react";
import { socialDay } from "@my-better-t-app/backend/convex/lib/social";

/** Refresh daily help and card requests for tabs that stay open overnight. */
export function useSocialDay() {
  const [day, setDay] = useState(() => socialDay());
  useEffect(() => {
    const update = () => setDay(socialDay());
    const timer = setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return day;
}
