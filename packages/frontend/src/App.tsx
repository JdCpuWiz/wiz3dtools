import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { QueueList } from './components/queue/QueueList';
import { UploadZone } from './components/upload/UploadZone';

function App() {
  const [activeTab, setActiveTab] = useState<'queue' | 'upload'>('queue');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 inline-flex">
          <button
            onClick={() => setActiveTab('queue')}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${activeTab === 'queue'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Queue
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${activeTab === 'upload'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            Upload Invoice
          </button>
        </div>

        {/* Content */}
        {activeTab === 'queue' ? <QueueList /> : <UploadZone />}
      </div>
    </Layout>
  );
}

export default App;
