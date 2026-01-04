import type { ReactNode } from 'react'

interface SectionHeaderProps {
    title: string
    description?: string
    icon?: ReactNode
    children?: ReactNode // For buttons, filters, etc.
}

export default function SectionHeader({ title, description, icon, children }: SectionHeaderProps) {
    return (
        <div
            className="card"
            style={{
                marginBottom: 'var(--spacing-lg)',
                border: '2px solid #000',
                padding: 'var(--spacing-md)',
                boxShadow: 'none',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-sm)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        {icon}
                        <h2
                            style={{
                                margin: 0,
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 700,
                                color: 'var(--color-text)',
                            }}
                        >
                            {title}
                        </h2>
                    </div>
                    {description && (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 400,
                            }}
                        >
                            {description}
                        </p>
                    )}
                </div>
                {children && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                        {children}
                    </div>
                )}
            </div>
        </div>
    )
}
