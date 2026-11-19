import { PageContainer, StatePanel } from '../../components/ui';

export default function MarketLoading() {
  return (
    <PageContainer>
      <h1>Chợ nông sản</h1>
      <StatePanel title="Đang tải danh sách lô" description="Vui lòng chờ trong giây lát." announce />
    </PageContainer>
  );
}
