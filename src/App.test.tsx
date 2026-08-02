import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App'

describe('App', () => {
  const theme = createTheme()

  const renderApp = () =>
    render(
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>,
    )

  it('应该显示应用标题 SnapMaster', () => {
    renderApp()
    expect(screen.getByText('SnapMaster')).toBeInTheDocument()
  })

  it('应该渲染一个 MUI Button 组件', () => {
    renderApp()
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })
})
