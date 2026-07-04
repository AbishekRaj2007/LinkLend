import { Switch, Route, Redirect, useLocation } from "wouter";
import Dashboard from "./components/Dashboard";
import AssessmentView from "./components/AssessmentView";
import BorrowerDashboard from "./components/BorrowerDashboard";
import { type Page } from "./components/Sidebar";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ProtectedRoute from "./lib/ProtectedRoute";

const PAGES: readonly Page[] = ["assess", "portfolio", "approvals", "reports"];

function isPage(value: string): value is Page {
  return (PAGES as readonly string[]).includes(value);
}

function LandingPage() {
  const [, setLocation] = useLocation();
  return <Dashboard onGetStarted={() => setLocation("/signup")} />;
}

function AssessmentRoute({ params }: { params: { page: string } }) {
  const [, setLocation] = useLocation();
  const page = isPage(params.page) ? params.page : "assess";

  return (
    <ProtectedRoute requiredRole="lender">
      <AssessmentView
        page={page}
        onNavigate={(next) => setLocation(`/app/${next}`)}
        onBack={() => setLocation("/")}
      />
    </ProtectedRoute>
  );
}

function BorrowerRoute() {
  return (
    <ProtectedRoute requiredRole="borrower">
      <BorrowerDashboard />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <div className="min-h-[100dvh] w-full text-foreground bg-background">
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/signup" component={SignUp} />
        <Route path="/login" component={Login} />
        <Route path="/app/:page" component={AssessmentRoute} />
        <Route path="/app">
          <Redirect to="/app/assess" />
        </Route>
        <Route path="/borrower" component={BorrowerRoute} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </div>
  );
}

export default App;
