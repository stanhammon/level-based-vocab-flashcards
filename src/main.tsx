import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AccountPage } from './features/account/AccountPage'
import { HomeRedirect, LanguagePage } from './features/languages/LanguagePage'
import { ProgressPage } from './features/progress/ProgressPage'
import { QuizPage } from './features/quiz/QuizPage'
import { SetupPage } from './features/setup/SetupPage'
import './index.css'
import { AuthProvider } from './lib/auth'
import { ProgressProvider } from './lib/progress'

const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/languages', element: <LanguagePage /> },
  { path: '/account', element: <AccountPage /> },
  { path: '/:lang', element: <SetupPage /> },
  { path: '/:lang/quiz', element: <QuizPage /> },
  { path: '/:lang/progress', element: <ProgressPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ProgressProvider>
        <RouterProvider router={router} />
      </ProgressProvider>
    </AuthProvider>
  </StrictMode>,
)
