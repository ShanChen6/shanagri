import Link from 'next/link';
import { PageContainer, StatePanel } from '../components/ui';

export default function NotFound() {
  return (
    <PageContainer>
      <StatePanel
        heading="h1"
        title="Không tìm thấy trang"
        description="Hãy kiểm tra lại địa chỉ hoặc quay về Chợ nông sản để tìm lô đang mở bán."
        actions={<><Link href="/cho-nong-san">Về Chợ nông sản</Link><Link href="/">Về trang tổng quan</Link></>}
      />
    </PageContainer>
  );
}
