import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { HomeRedirect, LanguagePage } from './features/languages/LanguagePage'
import { QuizPage } from './features/quiz/QuizPage'
import { SetupPage } from './features/setup/SetupPage'
import './index.css'

const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/languages', element: <LanguagePage /> },
  { path: '/:lang', element: <SetupPage /> },
  { path: '/:lang/quiz', element: <QuizPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
