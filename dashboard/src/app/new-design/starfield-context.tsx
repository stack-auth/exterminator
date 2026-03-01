"use client";

import { createContext, useContext, useState } from "react";

type StarfieldContextType = {
  showStreaks: boolean;
  setShowStreaks: (v: boolean) => void;
};

const StarfieldContext = createContext<StarfieldContextType>({
  showStreaks: true,
  setShowStreaks: () => {},
});

export function StarfieldProvider({ children }: { children: React.ReactNode }) {
  const [showStreaks, setShowStreaks] = useState(true);
  return (
    <StarfieldContext.Provider value={{ showStreaks, setShowStreaks }}>
      {children}
    </StarfieldContext.Provider>
  );
}

export function useStarfield() {
  return useContext(StarfieldContext);
}
