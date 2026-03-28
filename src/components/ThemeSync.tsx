import useThemeStore from "../store/useThemeStore";
import { useEffect } from "react";

const ThemeSync = () => {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.className = theme;
    document.body.className = theme;
  }, [theme]);

  return null;
};

export { ThemeSync };
