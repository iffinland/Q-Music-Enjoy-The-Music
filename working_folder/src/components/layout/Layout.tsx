import React from 'react'
import Sidebar  from '../Sidebar'
import Player from '../Player'

interface SidebarProps {
    children: React.ReactNode
}

export const Layout: React.FC<SidebarProps> = ({children}) => {
  return (
    <>
      <Sidebar songs={[]}>{children}</Sidebar>
    <Player />
    </>
  
  )
}
