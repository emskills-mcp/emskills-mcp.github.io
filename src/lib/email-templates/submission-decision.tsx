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
  decision?: 'approved' | 'rejected'
  notes?: string
  reviewedAt?: string
  skillUrl?: string
  contributeUrl?: string
}

const Email = ({
  skillName = 'Your skill submission',
  slug = '',
  decision = 'approved',
  notes = '',
  reviewedAt = '',
  skillUrl = 'https://emskills.org/skills',
  contributeUrl = 'https://emskills.org/contribute',
}: Props) => {
  const approved = decision === 'approved'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${skillName} was ${approved ? 'approved' : 'not approved'}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>emskills · submission update</Text>
          <Heading style={h1}>
            {skillName} was {approved ? 'approved' : 'not approved'}
          </Heading>
          <Text style={text}>
            {approved
              ? 'Your submission passed review and is now published in the emskills registry, discoverable by agents and the public directory.'
              : 'An administrator reviewed your submission and did not publish it this time. You can address the notes below and resubmit.'}
          </Text>

          <Section style={panel}>
            <Text style={rowStyle}>
              <span style={rowLabel}>slug</span>
              <span style={rowValue}>{slug || '—'}</span>
            </Text>
            <Text style={rowStyle}>
              <span style={rowLabel}>decision</span>
              <span style={{ ...rowValue, color: approved ? '#0f6f8c' : '#a33a2f' }}>
                {approved ? 'approved' : 'rejected'}
              </span>
            </Text>
            {reviewedAt ? (
              <Text style={rowStyle}>
                <span style={rowLabel}>reviewed</span>
                <span style={rowValue}>{reviewedAt}</span>
              </Text>
            ) : null}
          </Section>

          {notes ? (
            <>
              <Text style={notesLabel}>Reviewer notes</Text>
              <Text style={notesBox}>{notes}</Text>
            </>
          ) : null}

          <Button href={approved ? skillUrl : contributeUrl} style={button}>
            {approved ? 'View your skill' : 'Revise and resubmit'}
          </Button>

          <Hr style={hr} />
          <Text style={footer}>
            You receive this because you submitted a skill to the emskills registry.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `${(data['skillName'] as string) || 'Your submission'} was ${
      data['decision'] === 'rejected' ? 'not approved' : 'approved'
    }`,
  displayName: 'Submission decision (contributor)',
  previewData: {
    skillName: 'Cryo 2D Classifier',
    slug: 'cryo2d-classify',
    decision: 'approved',
    notes: 'Great manifest — tool schema matches the template.',
    reviewedAt: '2026-08-26',
    skillUrl: 'https://emskills.org/skills/cryo2d-classify',
    contributeUrl: 'https://emskills.org/contribute',
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
  margin: '0 0 20px',
}
const rowStyle = { margin: '6px 0', fontSize: '13px' }
const rowLabel = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: '#5b6b7a',
  display: 'inline-block',
  minWidth: '90px',
}
const rowValue = { color: '#0f1b26' }
const notesLabel = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: '#5b6b7a',
  margin: '0 0 6px',
}
const notesBox = {
  border: '1px solid #dbe3ea',
  borderLeft: '3px solid #0f6f8c',
  borderRadius: '6px',
  padding: '12px 14px',
  fontSize: '14px',
  lineHeight: '22px',
  color: '#31414f',
  margin: '0 0 22px',
}
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
