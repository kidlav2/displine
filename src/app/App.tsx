import { RouterProvider } from "react-router";
import { AuthProvider } from "../contexts/AuthContext";
import { AppProvider } from "../contexts/AppContext";
import { router } from "./router";
import { jk } from "../constants/design";

export default function App() {
  return (
    <div style={jk}>
      <AuthProvider>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </AuthProvider>
    </div>
  );
}
