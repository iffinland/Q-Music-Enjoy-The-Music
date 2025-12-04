import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './state/store'
import './polyfills/qortal'
interface CustomWindow extends Window {
  _qdnBase: any 
}

const customWindow = window as unknown as CustomWindow

const baseUrl = customWindow?._qdnBase || ''
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <BrowserRouter basename={baseUrl}>
      <App />
      <div id="modal-root" />
    </BrowserRouter>
  </Provider>
)
