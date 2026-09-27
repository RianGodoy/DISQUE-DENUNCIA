import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './global.css'

/* HashRouter: o endereço fica "site/#/acompanhar". O servidor (e os logs
   dele) só veem "site/", nunca em que tela a pessoa estava. */
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
