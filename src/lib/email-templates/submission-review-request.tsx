import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  skillName?: string
  slug?: string
  technique?: string
  kind?: string
  org?: string
  repo?: string
  origin?: string
  reviewUrl?: string
}

const Email = ({
  skillName = 'a new skill',
  slug = '',
  technique = '—',
  kind = '—',
  org = '—',
  repo = '',
  origin = 'manual submission',
  reviewUrl = 'https://emskills.org/admin/review',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Review queue: ${skillName} is waiting for approval`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>emskills · review queue</Text>
        <Heading style={h1}>{skillName} is ready for review</Heading>
        <Text style={text}>
          A new skill submission entered the moderation queue and is waiting on an
          admin decision.
        </Text>

        <Section style={panel}>
          <Row label="slug" value={slug || '—'} />
          <Row label="technique" value={technique} />
          <Row label="kind" value={kind} />
          <Row label="publisher" value={org} />
          <Row label="repository" value={repo || '—'} />
          <Row label="origin" value={origin} />
        </Section>

        <Button href={reviewUrl} style={button}>
          Open review queue
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          You receive this because you are an administrator of the emskills registry.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowStyle}>
    <span style={rowLabel}>{label}</span>
    <span style={rowValue}>{value}</span>
  </Text>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Review needed: ${(data['skillName'] as string) || 'new skill submission'}`,
  displayName: 'Submission ready for review (admin)',
  previewData: {
    skillName: 'Cryo 2D Classifier',
    slug: 'cryo2d-classify',
    technique: 'Cryo-EM',
    kind: 'MCP server',
    org: 'Northwestern NUANCE',
    repo: 'emskills-mcp/em-skills',
    origin: 'manual submission',
    reviewUrl: 'https://emskills.org/admin/review',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const eyebrow = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#5b6b7a',
  margin: '0 0 6px',
}
const h1 = { fontSize: '22px', lineHeight: '30px', color: '#0f1b26', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#31414f', margin: '0 0 18px' }
const panel = {
  border: '1px solid #dbe3ea',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '0 0 22px',
}
const rowStyle = { margin: '6px 0', fontSize: '13px' }
const rowLabel = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: '#5b6b7a',
  display: 'inline-block',
  minWidth: '110px',
}
const rowValue = { color: '#0f1b26' }
const button = {
  backgroundColor: '#0f6f8c',
  color: '#ffffff',
  borderRadius: '6px',
  padding: '11px 20px',
  fontSize: '14px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e5eaef', margin: '26px 0 14px' }
const footer = { fontSize: '12px', color: '#6b7a88', margin: 0 }
