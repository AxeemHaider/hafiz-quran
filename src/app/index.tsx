import { Redirect } from 'expo-router';

import { DEFAULT_PRINTED_PAGE } from '@/mushaf/page-number';

export default function Index() {
  return <Redirect href={{ pathname: '/[page]', params: { page: String(DEFAULT_PRINTED_PAGE) } }} />;
}
