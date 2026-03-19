-- conversations: a chat thread scoped to an organization
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizationid TEXT NOT NULL,
  title TEXT,
  createdby TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE INDEX idx_conversations_organizationid ON public.conversations(organizationid);
CREATE INDEX idx_conversations_createdby ON public.conversations(createdby);
CREATE INDEX idx_conversations_deletedat ON public.conversations(deletedat);

-- conversationparticipants: humans and agents in a conversation
CREATE TABLE public.conversationparticipants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversationid UUID NOT NULL,
  participanttype TEXT NOT NULL,
  participantid TEXT NOT NULL,
  participantname TEXT,
  joinedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE INDEX idx_conversationparticipants_conversationid ON public.conversationparticipants(conversationid);
CREATE INDEX idx_conversationparticipants_participantid ON public.conversationparticipants(participantid);
CREATE INDEX idx_conversationparticipants_deletedat ON public.conversationparticipants(deletedat);

-- messages: individual messages within a conversation
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversationid UUID NOT NULL,
  sendertype TEXT NOT NULL,
  senderid TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversationid ON public.messages(conversationid);
CREATE INDEX idx_messages_senderid ON public.messages(senderid);
CREATE INDEX idx_messages_deletedat ON public.messages(deletedat);

-- messageattachments: files, artifacts, media attached to messages
CREATE TABLE public.messageattachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messageid UUID NOT NULL,
  type TEXT NOT NULL,
  filename TEXT,
  mediatype TEXT,
  url TEXT,
  sizebytes BIGINT,
  metadata JSONB DEFAULT '{}',
  createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deletedat TIMESTAMPTZ
);

CREATE INDEX idx_messageattachments_messageid ON public.messageattachments(messageid);
CREATE INDEX idx_messageattachments_deletedat ON public.messageattachments(deletedat);
