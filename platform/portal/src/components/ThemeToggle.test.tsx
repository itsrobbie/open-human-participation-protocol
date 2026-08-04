import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => localStorage.clear())

  it('ThemeToggle_CyclesLightDarkSystemAndLabelsControl', async () => {
    localStorage.setItem('ohpp_theme', 'light')
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /Theme: Light/ })
    await user.click(button)
    expect(screen.getByRole('button', { name: /Theme: Dark/ })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')

    await user.click(button)
    expect(screen.getByRole('button', { name: /Theme: Auto/ })).toBeInTheDocument()

    await user.click(button)
    expect(screen.getByRole('button', { name: /Theme: Light/ })).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
