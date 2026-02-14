'use client';

import JobsTable from '@/components/JobsTable';
import { TopBar, MainContent } from '@/components/layout';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <>
      <TopBar>
        <div>
          <h1 className="text-lg">训练队列</h1>
        </div>
        <div className="flex-1"></div>
        <div>
          <Link href="/jobs/new" className="text-gray-200 bg-slate-600 px-3 py-1 rounded-md">
            新建训练任务
          </Link>
        </div>
      </TopBar>
      <MainContent>
        <JobsTable />
      </MainContent>
    </>
  );
}
