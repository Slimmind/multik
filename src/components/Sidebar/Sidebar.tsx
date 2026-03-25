import { PropsWithChildren, ReactNode } from 'react';
import './sidebar.styles.css';

type SidebarProps = {} & PropsWithChildren;

export const Sidebar = ({ children }: SidebarProps) => {
	return <aside className='sidebar'>{children}</aside>;
};
