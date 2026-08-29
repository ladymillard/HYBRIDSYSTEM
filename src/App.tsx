import React, { useState } from 'react';
import { TeamOSProvider, useTeamOS } from './context/TeamOSContext';
import { AppShell } from './components/AppShell';
import { MissionsListView } from './components/MissionsListView';
import { MissionDetailView } from './components/MissionDetailView';
import { TeamRosterView } from './components/TeamRosterView';
import { TeamMemoryView } from './components/TeamMemoryView';
import { PlaybooksView } from './components/PlaybooksView';
import { BlueprintView } from './components/BlueprintView';
import { SettingsView } from './components/SettingsView';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<string>('missions');
  const { selectedMissionId, setSelectedMissionId } = useTeamOS();

  const handleSelectMission = (missionId: string) => {
    setSelectedMissionId(missionId);
    setCurrentTab('missions');
  };

  const handleBackToMissionsList = () => {
    setSelectedMissionId(null);
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    // If switching to missions tab directly from another tab, keep detail if selected or show list
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'missions':
        if (selectedMissionId) {
          return (
            <MissionDetailView
              missionId={selectedMissionId}
              onBack={handleBackToMissionsList}
            />
          );
        }
        return <MissionsListView onSelectMission={handleSelectMission} />;
      case 'team':
        return <TeamRosterView />;
      case 'memory':
        return <TeamMemoryView onNavigateToMission={handleSelectMission} />;
      case 'playbooks':
        return <PlaybooksView />;
      case 'blueprint':
        return <BlueprintView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <MissionsListView onSelectMission={handleSelectMission} />;
    }
  };

  return (
    <AppShell currentTab={currentTab} onTabChange={handleTabChange}>
      {renderContent()}
    </AppShell>
  );
}

export default function App() {
  return (
    <TeamOSProvider>
      <MainApp />
    </TeamOSProvider>
  );
}
