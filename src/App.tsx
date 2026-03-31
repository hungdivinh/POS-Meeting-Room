import { useState, useEffect, useCallback, useMemo } from 'react';
import { roomsApi, bookingsApi, type Room, type Booking } from './api';
import { format, addDays, subDays, startOfWeek, endOfWeek, parseISO, eachDayOfInterval, getDay, isAfter, startOfDay, endOfDay } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, User as UserIcon, LayoutGrid, List, Settings, Edit2 } from 'lucide-react';

interface UserProfile {
  name: string;
  email: string;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday (0 is Sunday in date-fns)
const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const isAdmin = userProfile?.email.includes('admin-posXLHH') || false;

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  
  // Profile Form
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  // Booking Form
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bProject, setBProject] = useState('');
  const [bPurpose, setBPurpose] = useState('');
  const [bRoomId, setBRoomId] = useState('');
  const [bDate, setBDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bStartTime, setBStartTime] = useState('08:00');
  const [bEndTime, setBEndTime] = useState('09:00');
  const [bColor, setBColor] = useState('');
  
  // Repeat Form
  const [isRepeat, setIsRepeat] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatEndDate, setRepeatEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  // Room Form
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [rName, setRName] = useState('');
  const [rCapacity, setRCapacity] = useState(10);
  const [rLocation, setRLocation] = useState('');
  const [rStatus, setRStatus] = useState('Đang hoạt động');
  const [rColor, setRColor] = useState('#3b82f6');

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchRooms = useCallback(async () => {
    try {
      const data = await roomsApi.list();
      setRooms(data);
    } catch (e) {
      console.error('Failed to fetch rooms:', e);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    let startDate: Date;
    let endDate: Date;

    if (viewMode === 'day') {
      startDate = startOfDay(selectedDate);
      endDate = endOfDay(selectedDate);
    } else {
      startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
      endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
    }

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    try {
      const data = await bookingsApi.list(startStr, endStr);
      data.sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());
      setBookings(data);
    } catch (e) {
      console.error('Failed to fetch bookings:', e);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const storedProfile = localStorage.getItem('meetingUserProfile');
    if (storedProfile) {
      setUserProfile(JSON.parse(storedProfile));
    } else {
      setIsProfileModalOpen(true);
    }
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    fetchBookings();
    // Poll every 30 seconds for near-realtime updates
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  // Sort rooms: active first, then inactive; within each group sort by name
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aActive = a.status?.includes('hoạt động') ? 0 : 1;
      const bActive = b.status?.includes('hoạt động') ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [rooms]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName || !profileEmail) return;
    
    const profile = { name: profileName, email: profileEmail };
    localStorage.setItem('meetingUserProfile', JSON.stringify(profile));
    setUserProfile(profile);
    setIsProfileModalOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('meetingUserProfile');
    setUserProfile(null);
    setIsProfileModalOpen(true);
    setProfileName('');
    setProfileEmail('');
  };

  const checkOverlap = (roomId: string, startIso: string, endIso: string, dateStr: string, excludeBookingId?: string) => {
    const start = parseISO(startIso);
    const end = parseISO(endIso);
    
    return bookings.some(b => {
      if (b.id === excludeBookingId) return false;
      if (b.roomId !== roomId || b.date !== dateStr) return false;
      const bStart = parseISO(b.startTime);
      const bEnd = parseISO(b.endTime);
      return (bStart < end && bEnd > start);
    });
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !bRoomId) return;

    try {
      const startIso = `${bDate}T${bStartTime}:00`;
      const endIso = `${bDate}T${bEndTime}:00`;

      if (editingBooking) {
        if (checkOverlap(bRoomId, startIso, endIso, bDate, editingBooking.id)) {
          alert("Khung giờ này đã có người đặt.");
          return;
        }

        const updatedBooking: any = {
          roomId: bRoomId,
          project: bProject,
          purpose: bPurpose,
          startTime: startIso,
          endTime: endIso,
          date: bDate
        };
        if (isAdmin && bColor) {
          updatedBooking.color = bColor;
        } else if (isAdmin && !bColor) {
          updatedBooking.color = '';
        }

        await bookingsApi.update(editingBooking.id, updatedBooking);
      } else {
        if (!isRepeat) {
          if (checkOverlap(bRoomId, startIso, endIso, bDate)) {
            alert("Khung giờ này đã có người đặt.");
            return;
          }

          const newBooking: any = {
            roomId: bRoomId,
            userName: userProfile.name,
            userEmail: userProfile.email,
            project: bProject,
            purpose: bPurpose,
            startTime: startIso,
            endTime: endIso,
            date: bDate
          };
          if (isAdmin && bColor) {
            newBooking.color = bColor;
          }

          await bookingsApi.create(newBooking);
        } else {
          if (repeatDays.length === 0) {
            alert("Vui lòng chọn ít nhất 1 ngày trong tuần để lặp lại.");
            return;
          }

          const startDate = parseISO(bDate);
          const endDate = parseISO(repeatEndDate);

          if (isAfter(startDate, endDate)) {
            alert("Ngày kết thúc lặp lại phải sau ngày bắt đầu.");
            return;
          }

          const daysToBook = eachDayOfInterval({ start: startDate, end: endDate })
            .filter(date => repeatDays.includes(getDay(date)));

          if (daysToBook.length === 0) {
            alert("Không có ngày nào phù hợp trong khoảng thời gian đã chọn.");
            return;
          }

          const repeatGroupId = `rep_${Date.now()}`;
          let hasOverlap = false;
          const batchBookings: any[] = [];

          for (const date of daysToBook) {
            const dateStr = format(date, 'yyyy-MM-dd');
            const startIso = `${dateStr}T${bStartTime}:00`;
            const endIso = `${dateStr}T${bEndTime}:00`;

            if (checkOverlap(bRoomId, startIso, endIso, dateStr)) {
              hasOverlap = true;
              break;
            }

            const newBooking: any = {
              roomId: bRoomId,
              userName: userProfile.name,
              userEmail: userProfile.email,
              project: bProject,
              purpose: bPurpose,
              startTime: startIso,
              endTime: endIso,
              date: dateStr,
              repeatGroupId: repeatGroupId
            };
            if (isAdmin && bColor) {
              newBooking.color = bColor;
            }
            batchBookings.push(newBooking);
          }

          if (hasOverlap) {
            alert("Một số ngày trong chuỗi lặp lại bị trùng lịch. Vui lòng kiểm tra lại.");
            return;
          }

          await bookingsApi.create(batchBookings);
        }
      }

      setIsBookingModalOpen(false);
      setEditingBooking(null);
      setBProject('');
      setBPurpose('');
      setIsRepeat(false);
      setRepeatDays([]);
      fetchBookings();
    } catch (error) {
      console.error('Booking error:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const handleDeleteBooking = (bookingId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa lịch đặt phòng',
      message: 'Bạn có chắc chắn muốn xóa lịch đặt phòng này?',
      onConfirm: async () => {
        try {
          await bookingsApi.delete(bookingId);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          fetchBookings();
        } catch (error) {
          console.error('Delete booking error:', error);
        }
      }
    });
  };

  const toggleRepeatDay = (day: number) => {
    if (repeatDays.includes(day)) {
      setRepeatDays(repeatDays.filter(d => d !== day));
    } else {
      setRepeatDays([...repeatDays, day]);
    }
  };

  const openBookingModalWithDefaults = (roomId?: string, date?: string, startHour?: number) => {
    setEditingBooking(null);
    if (roomId) setBRoomId(roomId);
    if (date) setBDate(date);
    if (startHour !== undefined) {
      setBStartTime(`${startHour.toString().padStart(2, '0')}:00`);
      setBEndTime(`${(startHour + 1).toString().padStart(2, '0')}:00`);
    }
    setBProject('');
    setBPurpose('');
    setIsRepeat(false);
    setIsBookingModalOpen(true);
  };

  const openEditBookingModal = (booking: Booking) => {
    setEditingBooking(booking);
    setBRoomId(booking.roomId);
    setBDate(booking.date);
    setBStartTime(format(parseISO(booking.startTime), 'HH:mm'));
    setBEndTime(format(parseISO(booking.endTime), 'HH:mm'));
    setBProject(booking.project);
    setBPurpose(booking.purpose);
    setIsRepeat(false);
    setIsBookingModalOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName) return;

    try {
      const roomData = {
        name: rName,
        capacity: rCapacity,
        location: rLocation,
        status: rStatus,
        color: rColor
      };

      if (editingRoom) {
        await roomsApi.update(editingRoom.id, roomData);
      } else {
        await roomsApi.create(roomData as Omit<Room, 'id'>);
      }

      setEditingRoom(null);
      setRName('');
      setRCapacity(10);
      setRLocation('');
      setRStatus('Đang hoạt động');
      setRColor('#3b82f6');
      fetchRooms();
    } catch (error) {
      console.error('Room save error:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const handleDeleteRoom = (roomId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa phòng họp',
      message: 'Bạn có chắc chắn muốn xóa phòng họp này?',
      onConfirm: async () => {
        try {
          await roomsApi.delete(roomId);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          fetchRooms();
        } catch (error) {
          console.error('Delete room error:', error);
        }
      }
    });
  };

  const openRoomModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRName(room.name);
      setRCapacity(room.capacity || 0);
      setRLocation(room.location || '');
      setRStatus(room.status || 'Đang hoạt động');
      setRColor(room.color || '#3b82f6');
    } else {
      setEditingRoom(null);
      setRName('');
      setRCapacity(10);
      setRLocation('');
      setRStatus('Đang hoạt động');
      setRColor('#3b82f6');
    }
  };

  const seedRooms = async () => {
    const sampleRooms = [
      { name: '01 - Chiến lược', capacity: 0, color: '#ef4444', location: 'VP01 tầng 2', status: 'Đang triển khai hoán cải' },
      { name: '02 - Điều hành', capacity: 0, color: '#ef4444', location: 'VP01 tầng 2', status: 'Đang triển khai hoán cải' },
      { name: '03 - Hội nghị', capacity: 40, color: '#3b82f6', location: 'VP02 tầng 3, Phòng họp lớn', status: 'Đang hoạt động' },
      { name: '04 - Chế tạo', capacity: 10, color: '#10b981', location: 'VP02 tầng 3, khu vực bên ngoài P.XLHH, đối diện thang máy', status: 'Đang hoạt động' },
      { name: '05 - Lắp đặt', capacity: 10, color: '#f59e0b', location: 'VP02 tầng 3, khu vực bên ngoài P.XLHH, đối diện thang máy', status: 'Đang hoạt động' },
    ];

    try {
      for (const room of sampleRooms) {
        await roomsApi.create(room as Omit<Room, 'id'>);
      }
      fetchRooms();
    } catch (error) {
      console.error('Seed rooms error:', error);
    }
  };

  const renderDayView = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Timeline Header */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 shrink-0 border-r border-gray-200 p-4 font-bold text-blue-900 flex items-center justify-center uppercase">
              Phòng Họp
            </div>
            <div className="flex-1 flex">
              {HOURS.map(hour => (
                <div key={hour} className="flex-1 border-r border-gray-200 p-2 text-center text-sm font-bold text-blue-900 min-w-[80px]">
                  {hour}:00
                </div>
              ))}
            </div>
          </div>

          {/* Rooms and Timeline */}
          <div className="divide-y divide-gray-200">
            {sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Chưa có phòng họp nào.</div>
            ) : (
              sortedRooms.map(room => {
                const isActive = room.status?.includes('hoạt động');
                return (
                <div key={room.id} className={`flex group ${!isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                  {/* Room Info */}
                  <div
                    className="w-48 shrink-0 border-r border-gray-200 p-3 bg-white relative z-10 flex flex-col justify-center"
                    style={{ borderLeft: `4px solid ${room.color}` }}
                  >
                    <div className={`font-medium text-sm ${!isActive ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {room.name}
                    </div>
                    {room.capacity > 0 && <div className="text-sm text-gray-600 mt-0.5">Sức chứa: {room.capacity} người</div>}
                    {room.location && <div className="text-sm text-gray-600 mt-0.5">Vị trí: {room.location}</div>}
                  </div>

                  {/* Timeline Slots */}
                  <div className="flex-1 flex relative bg-white">
                    {HOURS.map(hour => {
                      const slotStart = new Date(selectedDate);
                      slotStart.setHours(hour, 0, 0, 0);
                      
                      const slotEnd = new Date(selectedDate);
                      slotEnd.setHours(hour + 1, 0, 0, 0);

                      const overlappingBookings = bookings.filter(b => {
                        if (b.roomId !== room.id) return false;
                        const bStart = parseISO(b.startTime);
                        const bEnd = parseISO(b.endTime);
                        return (bStart < slotEnd && bEnd > slotStart);
                      });

                      const isBooked = overlappingBookings.length > 0;

                      return (
                        <div 
                          key={hour} 
                          className={`flex-1 border-r border-gray-100 min-w-[80px] relative transition-colors ${room.status?.includes('hoạt động') ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
                          onClick={() => room.status?.includes('hoạt động') && openBookingModalWithDefaults(room.id, format(selectedDate, 'yyyy-MM-dd'), hour)}
                        >
                        </div>
                      );
                    })}

                    {/* Render Booking Blocks */}
                    {bookings.filter(b => b.roomId === room.id && b.date === format(selectedDate, 'yyyy-MM-dd')).map(booking => {
                      const bStart = parseISO(booking.startTime);
                      const bEnd = parseISO(booking.endTime);
                      
                      const startHour = bStart.getHours() + bStart.getMinutes() / 60;
                      const endHour = bEnd.getHours() + bEnd.getMinutes() / 60;
                      
                      if (endHour <= HOURS[0] || startHour >= HOURS[HOURS.length - 1] + 1) return null;

                      const visibleStartHour = Math.max(startHour, HOURS[0]);
                      const visibleEndHour = Math.min(endHour, HOURS[HOURS.length - 1] + 1);
                      
                      const leftPercent = ((visibleStartHour - HOURS[0]) / HOURS.length) * 100;
                      const widthPercent = ((visibleEndHour - visibleStartHour) / HOURS.length) * 100;

                      const isOwner = booking.userEmail === userProfile?.email;
                      const canEdit = isOwner || isAdmin;

                      return (
                        <div 
                          key={booking.id}
                          onClick={() => room.status?.includes('hoạt động') && openBookingModalWithDefaults(room.id, format(selectedDate, 'yyyy-MM-dd'), Math.floor(startHour))}
                          className={`absolute top-1 min-h-[calc(100%-8px)] h-auto rounded-md shadow-sm border p-2 flex flex-col justify-start group/booking z-20 ${!booking.color ? 'bg-yellow-50 border-yellow-200' : ''} ${room.status?.includes('hoạt động') ? 'cursor-pointer hover:shadow-md hover:border-yellow-400' : ''}`}
                          style={{ 
                            left: `${leftPercent}%`, 
                            width: `calc(${widthPercent}% - 4px)`,
                            ...(booking.color ? { backgroundColor: booking.color, borderColor: 'rgba(0,0,0,0.1)' } : {})
                          }}
                        >
                          <div className="text-xs font-semibold text-gray-900 break-words whitespace-normal">
                            {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}: {booking.userName}
                          </div>
                          {booking.project && <div className="text-xs text-gray-700 break-words whitespace-normal">DA: {booking.project}</div>}
                          {booking.purpose && <div className="text-xs text-gray-600 break-words whitespace-normal">{booking.purpose}</div>}
                          
                          {canEdit && (
                            <div className={`absolute top-1 right-1 flex gap-1 opacity-0 group-hover/booking:opacity-100 transition-all p-0.5 rounded ${!booking.color ? 'bg-yellow-50/90' : 'bg-white/50'}`}>
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditBookingModal(booking); }}
                                className="p-1 bg-white/90 rounded text-blue-600 hover:bg-blue-50"
                                title="Sửa"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBooking(booking.id); }}
                                className="p-1 bg-white/90 rounded text-red-600 hover:bg-red-50"
                                title="Xóa"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );})
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Header */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 shrink-0 border-r border-gray-200 p-4 font-bold text-blue-900 flex items-center justify-center uppercase">
              PHÒNG HỌP
            </div>
            <div className="w-24 shrink-0 border-r border-gray-200 p-4 font-bold text-blue-900 flex items-center justify-center uppercase">
              BUỔI/NGÀY
            </div>
            <div className="flex-1 flex">
              {weekDays.map((day, index) => (
                <div key={index} className="flex-1 border-r border-gray-200 p-2 text-center min-w-[120px]">
                  <div className="font-bold text-blue-900">{format(day, 'dd/MM')}</div>
                  <div className="text-sm text-gray-500">{DAY_NAMES[index]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="divide-y divide-gray-300">
            {sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Chưa có phòng họp nào.</div>
            ) : (
              sortedRooms.map(room => {
                const isActive = room.status?.includes('hoạt động');
                return (
                <div key={room.id} className={`flex border-b-2 border-gray-300 ${!isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                  {/* Room Name */}
                  <div
                    className="w-48 shrink-0 border-r border-gray-200 p-3 bg-white flex flex-col justify-center"
                    style={{ borderLeft: `4px solid ${room.color}` }}
                  >
                    <div className={`font-medium text-sm ${!isActive ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {room.name}
                    </div>
                    {room.capacity > 0 && <div className="text-sm text-gray-600 mt-0.5">Sức chứa: {room.capacity} người</div>}
                    {room.location && <div className="text-sm text-gray-600 mt-0.5">Vị trí: {room.location}</div>}
                  </div>

                  <div className="flex-1 flex flex-col divide-y divide-gray-200">
                    {/* Morning Row */}
                    <div className="flex flex-1 min-h-[80px]">
                      <div className="w-24 shrink-0 border-r border-gray-200 p-2 flex items-center justify-center font-medium text-gray-700 bg-gray-50">
                        Sáng
                      </div>
                      <div className="flex-1 flex">
                        {weekDays.map((day, index) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const morningBookings = bookings.filter(b => {
                            if (b.roomId !== room.id || b.date !== dateStr) return false;
                            const bStart = parseISO(b.startTime);
                            return bStart.getHours() < 12;
                          });

                          return (
                            <div 
                              key={`morning-${index}`} 
                              className={`flex-1 flex flex-col border-r border-gray-200 p-1 pb-8 min-w-[120px] relative h-full ${room.status?.includes('hoạt động') ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                              onClick={(e) => {
                                if (room.status?.includes('hoạt động')) {
                                  openBookingModalWithDefaults(room.id, dateStr, 8);
                                }
                              }}
                            >
                              {morningBookings.map(booking => {
                                const bStart = parseISO(booking.startTime);
                                const bEnd = parseISO(booking.endTime);
                                const isOwner = booking.userEmail === userProfile?.email;
                                const canEdit = isOwner || isAdmin;
                                
                                return (
                                  <div 
                                    key={booking.id} 
                                    className={`mb-1 p-1.5 border rounded text-xs relative group/booking ${!booking.color ? 'bg-yellow-50 border-yellow-200' : ''} ${canEdit ? 'hover:shadow-md hover:border-yellow-400' : ''}`}
                                    style={booking.color ? { backgroundColor: booking.color, borderColor: 'rgba(0,0,0,0.1)' } : {}}
                                  >
                                    <div className="font-semibold text-gray-900 break-words whitespace-normal">
                                      {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}: {booking.userName}
                                    </div>
                                    {booking.project && <div className="text-gray-700 break-words whitespace-normal">DA: {booking.project}</div>}
                                    {booking.purpose && <div className="text-gray-600 break-words whitespace-normal">{booking.purpose}</div>}
                                    {canEdit && (
                                      <div className={`absolute top-1 right-1 flex gap-1 opacity-0 group-hover/booking:opacity-100 transition-all p-0.5 rounded ${!booking.color ? 'bg-yellow-50/90' : 'bg-white/50'}`}>
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditBookingModal(booking); }}
                                          className="p-1 bg-white/90 rounded text-blue-600 hover:bg-blue-50"
                                          title="Sửa"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBooking(booking.id); }}
                                          className="p-1 bg-white/90 rounded text-red-600 hover:bg-red-50"
                                          title="Xóa"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Afternoon Row */}
                    <div className="flex flex-1 min-h-[80px]">
                      <div className="w-24 shrink-0 border-r border-gray-200 p-2 flex items-center justify-center font-medium text-gray-700 bg-gray-50">
                        Chiều
                      </div>
                      <div className="flex-1 flex bg-yellow-50/30">
                        {weekDays.map((day, index) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const afternoonBookings = bookings.filter(b => {
                            if (b.roomId !== room.id || b.date !== dateStr) return false;
                            const bStart = parseISO(b.startTime);
                            return bStart.getHours() >= 12;
                          });

                          return (
                            <div 
                              key={`afternoon-${index}`} 
                              className={`flex-1 flex flex-col border-r border-gray-200 p-1 pb-8 min-w-[120px] relative h-full ${room.status?.includes('hoạt động') ? 'hover:bg-yellow-50/50 cursor-pointer' : ''}`}
                              onClick={(e) => {
                                if (room.status?.includes('hoạt động')) {
                                  openBookingModalWithDefaults(room.id, dateStr, 13);
                                }
                              }}
                            >
                              {afternoonBookings.map(booking => {
                                const bStart = parseISO(booking.startTime);
                                const bEnd = parseISO(booking.endTime);
                                const isOwner = booking.userEmail === userProfile?.email;
                                const canEdit = isOwner || isAdmin;
                                
                                return (
                                  <div 
                                    key={booking.id} 
                                    className={`mb-1 p-1.5 border rounded text-xs relative group/booking ${!booking.color ? 'bg-yellow-100 border-yellow-300' : ''} ${canEdit ? 'hover:shadow-md hover:border-yellow-400' : ''}`}
                                    style={booking.color ? { backgroundColor: booking.color, borderColor: 'rgba(0,0,0,0.1)' } : {}}
                                  >
                                    <div className="font-semibold text-gray-900 break-words whitespace-normal">
                                      {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}: {booking.userName}
                                    </div>
                                    {booking.project && <div className="text-gray-700 break-words whitespace-normal">DA: {booking.project}</div>}
                                    {booking.purpose && <div className="text-gray-600 break-words whitespace-normal">{booking.purpose}</div>}
                                    {canEdit && (
                                      <div className={`absolute top-1 right-1 flex gap-1 opacity-0 group-hover/booking:opacity-100 transition-all p-0.5 rounded ${!booking.color ? 'bg-yellow-100/90' : 'bg-white/50'}`}>
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditBookingModal(booking); }}
                                          className="p-1 bg-white/90 rounded text-blue-600 hover:bg-blue-50"
                                          title="Sửa"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBooking(booking.id); }}
                                          className="p-1 bg-white/90 rounded text-red-600 hover:bg-red-50"
                                          title="Xóa"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );})
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-blue-900">Lịch Phòng Họp</h1>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <LayoutGrid size={16} /> Ngày
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <List size={16} /> Tuần
            </button>
          </div>

          <div className="flex items-center gap-2 ml-4 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setSelectedDate(viewMode === 'day' ? subDays(selectedDate, 1) : subDays(selectedDate, 7))}
              className="p-1.5 hover:bg-white rounded-md transition"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="relative flex items-center gap-2 px-4 font-medium text-gray-800 min-w-[150px] justify-center hover:bg-gray-200 py-1.5 rounded-md transition cursor-pointer">
              <Calendar size={18} className="text-blue-600" />
              {viewMode === 'day' 
                ? format(selectedDate, 'dd/MM/yyyy')
                : `Tuần ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')}`
              }
              <input 
                type="date" 
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(parseISO(e.target.value));
                  }
                }}
                className="date-picker-overlay"
              />
            </div>
            <button 
              onClick={() => setSelectedDate(viewMode === 'day' ? addDays(selectedDate, 1) : addDays(selectedDate, 7))}
              className="p-1.5 hover:bg-white rounded-md transition"
            >
              <ChevronRight size={20} />
            </button>
            <button 
              onClick={() => setSelectedDate(new Date())}
              className="ml-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition"
            >
              Hôm nay
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <button 
              onClick={() => setIsRoomModalOpen(true)}
              className="text-sm bg-purple-100 text-purple-700 px-3 py-1.5 rounded-md font-medium hover:bg-purple-200 flex items-center gap-2"
            >
              <Settings size={16} /> Quản lý phòng
            </button>
          )}
          {rooms.length === 0 && (
            <button 
              onClick={seedRooms}
              className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-md font-medium hover:bg-green-200"
            >
              Tạo phòng mẫu
            </button>
          )}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
              {userProfile?.name.charAt(0).toUpperCase() || <UserIcon size={16} />}
            </div>
            {userProfile?.name}
          </div>
          <button 
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 underline transition"
          >
            Đổi tài khoản
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {viewMode === 'day' ? renderDayView() : renderWeekView()}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => openBookingModalWithDefaults()}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-40"
      >
        <Plus size={28} />
      </button>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Đăng ký sử dụng</h2>
            <p className="text-gray-500 text-center mb-6 text-sm">Vui lòng nhập thông tin để đặt phòng họp</p>
            
            <form onSubmit={handleSaveProfile}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                  <input 
                    type="text" 
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="VD: a.nguyen@company.com"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full mt-8 bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Bắt đầu
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{editingBooking ? 'Chỉnh Sửa Lịch Đặt' : 'Đặt Phòng Họp'}</h2>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveBooking}>
              <div className="space-y-4">
                {/* User Info (Readonly) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Người đặt</label>
                    <input type="text" value={editingBooking ? editingBooking.userName : userProfile?.name || ''} disabled className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="text" value={editingBooking ? editingBooking.userEmail : userProfile?.email || ''} disabled className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
                  </div>
                </div>

                {/* Project & Purpose */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dự án</label>
                    <input 
                      type="text" 
                      value={bProject}
                      onChange={(e) => setBProject(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Tên dự án"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mục đích/Ghi chú</label>
                    <input 
                      type="text" 
                      value={bPurpose}
                      onChange={(e) => setBPurpose(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Mục đích cuộc họp"
                    />
                  </div>
                </div>

                {/* Room */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng họp <span className="text-red-500">*</span></label>
                  <select 
                    required
                    value={bRoomId}
                    onChange={(e) => setBRoomId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Chọn phòng họp --</option>
                    {rooms.filter(r => r.status?.includes('hoạt động') || r.id === bRoomId).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày <span className="text-red-500">*</span></label>
                    <input 
                      type="date" 
                      required
                      value={bDate}
                      onChange={(e) => setBDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Từ giờ <span className="text-red-500">*</span></label>
                    <input 
                      type="time" 
                      required
                      value={bStartTime}
                      onChange={(e) => setBStartTime(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đến giờ <span className="text-red-500">*</span></label>
                    <input 
                      type="time" 
                      required
                      value={bEndTime}
                      onChange={(e) => setBEndTime(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Color Picker (Admin Only) */}
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Màu hiển thị (Tùy chọn)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={bColor || '#fef08a'}
                        onChange={(e) => setBColor(e.target.value)}
                        className="w-10 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                      />
                      <button 
                        type="button" 
                        onClick={() => setBColor('')}
                        className="text-sm text-gray-500 hover:text-gray-700 underline"
                      >
                        Mặc định
                      </button>
                    </div>
                  </div>
                )}

                {/* Repeat (Only for new bookings) */}
                {!editingBooking && (
                  <div className="border-t border-gray-200 pt-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input 
                        type="checkbox" 
                        checked={isRepeat}
                        onChange={(e) => setIsRepeat(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Lặp lại hàng tuần</span>
                    </label>

                    {isRepeat && (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Lặp lại vào các ngày:</label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleRepeatDay(day)}
                                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                  repeatDays.includes(day) 
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {DAY_NAMES[index]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Lặp lại đến ngày:</label>
                          <input 
                            type="date" 
                            required={isRepeat}
                            value={repeatEndDate}
                            onChange={(e) => setRepeatEndDate(e.target.value)}
                            min={bDate}
                            className="w-full max-w-[200px] border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                >
                  {editingBooking ? 'Lưu thay đổi' : 'Xác nhận đặt phòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Management Modal (Admin Only) */}
      {isRoomModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Quản Lý Phòng Họp</h2>
              <button onClick={() => setIsRoomModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <div className="flex gap-6 flex-1 min-h-0">
              {/* Room List */}
              <div className="w-1/2 border-r border-gray-200 pr-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700">Danh sách phòng</h3>
                  <button 
                    onClick={() => openRoomModal()}
                    className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 flex items-center gap-1"
                  >
                    <Plus size={14} /> Thêm mới
                  </button>
                </div>
                <div className="space-y-3">
                  {rooms.map(room => (
                    <div key={room.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color }}></div>
                            {room.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Sức chứa: {room.capacity} | Vị trí: {room.location}</div>
                          <div className={`text-xs mt-1 font-medium ${room.status?.includes('hoạt động') ? 'text-green-600' : 'text-red-500'}`}>{room.status}</div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation(); 
                              openRoomModal(room); 
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation(); 
                              handleDeleteRoom(room.id); 
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Form */}
              <div className="w-1/2 pl-2 overflow-y-auto">
                <h3 className="font-semibold text-gray-700 mb-4">{editingRoom ? 'Sửa phòng họp' : 'Thêm phòng mới'}</h3>
                <form onSubmit={handleSaveRoom} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={rName}
                      onChange={(e) => setRName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sức chứa (người)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={rCapacity}
                      onChange={(e) => setRCapacity(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
                    <input 
                      type="text" 
                      value={rLocation}
                      onChange={(e) => setRLocation(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hiện trạng</label>
                    <select 
                      value={rStatus}
                      onChange={(e) => setRStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="Đang hoạt động">Đang hoạt động</option>
                      <option value="Đang triển khai hoán cải">Đang triển khai hoán cải</option>
                      <option value="Tạm ngưng">Tạm ngưng</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Màu sắc hiển thị</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={rColor}
                        onChange={(e) => setRColor(e.target.value)}
                        className="w-10 h-10 border-0 p-0 rounded cursor-pointer"
                      />
                      <span className="text-sm text-gray-500">{rColor}</span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    {editingRoom && (
                      <button 
                        type="button"
                        onClick={() => openRoomModal()}
                        className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
                      >
                        Hủy sửa
                      </button>
                    )}
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                    >
                      {editingRoom ? 'Lưu thay đổi' : 'Thêm phòng'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition shadow-sm"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
