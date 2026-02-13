import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { QueueList } from './components/queue/QueueList';
import { UploadZone } from './components/upload/UploadZone';

export type QueueFilter = 'all' | 'pending' | 'printing';

function App() {
  const [showUpload, setShowUpload] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');

  return (
    <Layout onUploadClick={() => setShowUpload(true)}>
      {showUpload ? (
        <UploadZone onClose={() => setShowUpload(false)} />
      ) : (
        <div className="space-y-6">
          {/* Queue Filter Tabs */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-1 inline-flex">
            <button
              onClick={() => setQueueFilter('all')}
              className={`
                px-6 py-2 rounded-md font-medium transition-colors text-base
                ${queueFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              All
            </button>
            <button
              onClick={() => setQueueFilter('pending')}
              className={`
                px-6 py-2 rounded-md font-medium transition-colors text-base
                ${queueFilter === 'pending'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              Pending
            </button>
            <button
              onClick={() => setQueueFilter('printing')}
              className={`
                px-6 py-2 rounded-md font-medium transition-colors text-base
                ${queueFilter === 'printing'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              Printing
            </button>
          </div>

          {/* Queue Content */}
          <QueueList filter={queueFilter} />
        </div>
      )}
    </Layout>
  );
}

export default App;
