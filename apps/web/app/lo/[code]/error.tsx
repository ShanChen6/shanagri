'use client';

import Link from 'next/link';
import { Button, PageContainer, StatePanel } from '../../../components/ui';

export default function BatchError() {
  return (
    <PageContainer>
      <StatePanel
        heading="h1"
        title="Không tải được thông tin lô"
        description="Vui lòng thử tải lại thông tin hoặc quay về Chợ nông sản."
        actions={
          <>
            <Button onClick={() => window.location.reload()}>Thử lại</Button>
            <Link href="/cho-nong-san">Về Chợ nông sản</Link>
          </>
        }
      />
    </PageContainer>
  );
}
