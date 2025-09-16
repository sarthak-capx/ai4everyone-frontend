import React from 'react';
import TopSection from './TopSection';
import BottomSection from './BottomSection';

const HomePage = React.memo(() => {
  return (
    <>
      <TopSection />
      <BottomSection />
    </>
  );
});

export default HomePage;