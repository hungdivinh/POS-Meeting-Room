import { useState, useEffect, useCallback, useMemo } from 'react';
import { roomsApi, bookingsApi, logsApi, needsApi, adminPhonesApi, type Room, type Booking, type ActivityLog, type Need } from './api';
import { format, addDays, subDays, startOfWeek, endOfWeek, parseISO, eachDayOfInterval, getDay, isAfter, startOfDay, endOfDay } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Plus, Trash2, User as UserIcon, LayoutGrid, List, Settings, Edit2, ClipboardList } from 'lucide-react';

interface UserProfile {
  name: string;
  phone: string;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday (0 is Sunday in date-fns)
const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const ROOMS_CACHE_KEY = 'meetingRoomsCacheV1';
const ROOMS_CACHE_TTL_MS = 5 * 60 * 1000;

function readRoomsCache(): Room[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(ROOMS_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { savedAt?: number; rooms?: Room[] };
    if (!parsed || !Array.isArray(parsed.rooms) || typeof parsed.savedAt !== 'number') {
      return [];
    }

    if (Date.now() - parsed.savedAt > ROOMS_CACHE_TTL_MS) {
      return [];
    }

    return parsed.rooms;
  } catch {
    return [];
  }
}

function writeRoomsCache(rooms: Room[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      ROOMS_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        rooms,
      }),
    );
  } catch {
    // Ignore storage quota or private-mode cache errors.
  }
}

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [rooms, setRooms] = useState<Room[]>(() => readRoomsCache());
  const [roomsLoading, setRoomsLoading] = useState<boolean>(() => readRoomsCache().length === 0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [adminPhones, setAdminPhones] = useState<string[]>([]);
  const [newAdminPhone, setNewAdminPhone] = useState('');

  const isAdmin = (userProfile?.name === 'admin-pos' && userProfile?.phone === '6530042026') || adminPhones.includes(userProfile?.phone || '') || false;

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);
  
  // Profile Form
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  // Booking Form
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bBookerName, setBBookerName] = useState('');
  const [bBookerPhone, setBBookerPhone] = useState('');
  const [bProject, setBProject] = useState('');
  const [bPurpose, setBPurpose] = useState('');
  const [bRoomId, setBRoomId] = useState('');
  const [bLocationFilter, setBLocationFilter] = useState<string[]>([]);
  const [bDate, setBDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bStartTime, setBStartTime] = useState('08:00');
  const [bEndTime, setBEndTime] = useState('09:00');
  const [bAttendeeCount, setBAttendeeCount] = useState('');
  const [bColor, setBColor] = useState('');
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [showNeeds, setShowNeeds] = useState(false);

  // Needs
  const [needs, setNeeds] = useState<Need[]>([]);
  const [editingNeed, setEditingNeed] = useState<Need | null>(null);
  const [nName, setNName] = useState('');
  const [nColor, setNColor] = useState('#fbbf24');
  const [adminTab, setAdminTab] = useState<'rooms' | 'needs' | 'admins'>('rooms');

  // Repeat Form
  const [isRepeat, setIsRepeat] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'week' | 'month'>('week');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatMonthDays, setRepeatMonthDays] = useState<number[]>([]);
  const [repeatEndDate, setRepeatEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));

  // Room Form
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [rName, setRName] = useState('');
  const [rCapacity, setRCapacity] = useState(10);
  const [rLocation, setRLocation] = useState('');
  const [rStatus, setRStatus] = useState('Đang hoạt động');
  const [rColor, setRColor] = useState('#3b82f6');
  const [rBuilding, setRBuilding] = useState('');
  const [rFloor, setRFloor] = useState('');

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Activity Log State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const bookingDetailsRoom = selectedBookingDetails
    ? rooms.find(r => r.id === selectedBookingDetails.roomId) ?? null
    : null;
  const bookingDetailsNeedNames = selectedBookingDetails
    ? (selectedBookingDetails.needIds || [])
        .map(nid => needs.find(n => n.id === nid)?.name)
        .filter(Boolean) as string[]
    : [];
  const bookingDetailsStart = selectedBookingDetails ? parseISO(selectedBookingDetails.startTime) : null;
  const bookingDetailsEnd = selectedBookingDetails ? parseISO(selectedBookingDetails.endTime) : null;
  const canManageSelectedBooking = selectedBookingDetails
    ? selectedBookingDetails.userPhone === userProfile?.phone || isAdmin
    : false;

  const fetchRooms = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setRoomsLoading(true);
    }

    try {
      const data = await roomsApi.list();
      setRooms(data);
      writeRoomsCache(data);
    } catch (e) {
      console.error('Failed to fetch rooms:', e);
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const fetchNeeds = useCallback(async () => {
    try {
      const data = await needsApi.list();
      setNeeds(data);
    } catch (e) {
      console.error('Failed to fetch needs:', e);
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
      const parsed = JSON.parse(storedProfile);
      if (parsed.phone) {
        setUserProfile(parsed);
      } else {
        // Old profile format (had email), force re-login
        localStorage.removeItem('meetingUserProfile');
        setIsProfileModalOpen(true);
      }
    } else {
      setIsProfileModalOpen(true);
    }
    fetchRooms(readRoomsCache().length === 0);
    fetchNeeds();
    adminPhonesApi.list().then(setAdminPhones).catch(() => {});
  }, [fetchRooms, fetchNeeds]);

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

  const getBookingColors = useCallback((booking: Booking): string[] => {
    if (booking.needIds && booking.needIds.length > 0) {
      return booking.needIds.map(nid => needs.find(n => n.id === nid)?.color).filter(Boolean) as string[];
    }
    if (booking.color) return [booking.color];
    return ['#fef08a']; // default yellow
  }, [needs]);

  const logActivity = useCallback((action: string, detail?: string) => {
    if (!userProfile) return;
    logsApi.create({ userName: userProfile.name, userPhone: userProfile.phone, action, detail }).catch(() => {});
  }, [userProfile]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await logsApi.list(500);
      setActivityLogs(data);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
    setLogsLoading(false);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName || !profilePhone) return;
    const isAdminLogin = profileName === 'admin-pos' && profilePhone === '6530042026';
    if (!isAdminLogin && (profilePhone.length < 10 || profilePhone.length > 11)) {
      alert('Số điện thoại phải có 10-11 số');
      return;
    }

    const profile = { name: profileName, phone: profilePhone };
    localStorage.setItem('meetingUserProfile', JSON.stringify(profile));
    setUserProfile(profile);
    logsApi.create({ userName: profileName, userPhone: profilePhone, action: 'Đăng nhập' }).catch(() => {});
    setIsProfileModalOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('meetingUserProfile');
    setUserProfile(null);
    setIsProfileModalOpen(true);
    setProfileName('');
    setProfilePhone('');
  };

  const findOverlap = (roomId: string, startIso: string, endIso: string, dateStr: string, excludeBookingId?: string) => {
    const start = parseISO(startIso);
    const end = parseISO(endIso);

    return bookings.find(b => {
      if (b.id === excludeBookingId) return false;
      if (b.roomId !== roomId || b.date !== dateStr) return false;
      const bStart = parseISO(b.startTime);
      const bEnd = parseISO(b.endTime);
      return (bStart < end && bEnd > start);
    }) || null;
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !bRoomId) return;

    try {
      const startIso = `${bDate}T${bStartTime}:00`;
      const endIso = `${bDate}T${bEndTime}:00`;
      const trimmedAttendeeCount = bAttendeeCount.trim();
      const attendeeCount = trimmedAttendeeCount === '' ? null : Number.parseInt(trimmedAttendeeCount, 10);

      if (trimmedAttendeeCount !== '' && (!Number.isInteger(attendeeCount) || attendeeCount < 1)) {
        alert('Số người phải là số nguyên lớn hơn 0.');
        return;
      }

      if (editingBooking) {
        const overlap = findOverlap(bRoomId, startIso, endIso, bDate, editingBooking.id);
        if (overlap) {
          alert(`Khung giờ này đã có người đặt.\nLiên hệ: ${overlap.userName} - ${overlap.userPhone}`);
          return;
        }

        const updatedBooking: any = {
          roomId: bRoomId,
          project: bProject,
          purpose: bPurpose,
          startTime: startIso,
          endTime: endIso,
          date: bDate,
          attendeeCount,
          needIds: selectedNeeds,
          color: isAdmin && bColor ? bColor : '',
          userName: bBookerName,
          userPhone: bBookerPhone
        };

        await bookingsApi.update(editingBooking.id, updatedBooking);
      } else {
        if (!isRepeat) {
          const overlap = findOverlap(bRoomId, startIso, endIso, bDate);
          if (overlap) {
            alert(`Khung giờ này đã có người đặt.\nLiên hệ: ${overlap.userName} - ${overlap.userPhone}`);
            return;
          }

          const newBooking: any = {
            roomId: bRoomId,
            userName: bBookerName || userProfile.name,
            userPhone: bBookerPhone || userProfile.phone,
            project: bProject,
            purpose: bPurpose,
            startTime: startIso,
            endTime: endIso,
            date: bDate,
            attendeeCount,
            needIds: selectedNeeds,
            color: isAdmin && bColor ? bColor : ''
          };

          await bookingsApi.create(newBooking);
        } else {
          if (repeatMode === 'week' && repeatDays.length === 0) {
            alert("Vui lòng chọn ít nhất 1 ngày trong tuần để lặp lại.");
            return;
          }
          if (repeatMode === 'month' && repeatMonthDays.length === 0) {
            alert("Vui lòng chọn ít nhất 1 ngày trong tháng để lặp lại.");
            return;
          }

          const startDate = parseISO(bDate);
          const endDate = parseISO(repeatEndDate);

          if (isAfter(startDate, endDate)) {
            alert("Ngày kết thúc lặp lại phải sau ngày bắt đầu.");
            return;
          }

          const allDays = eachDayOfInterval({ start: startDate, end: endDate });
          const daysToBook = repeatMode === 'week'
            ? allDays.filter(date => repeatDays.includes(getDay(date)))
            : allDays.filter(date => repeatMonthDays.includes(date.getDate()));

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

            if (findOverlap(bRoomId, startIso, endIso, dateStr)) {
              hasOverlap = true;
              break;
            }

            const newBooking: any = {
              roomId: bRoomId,
              userName: userProfile.name,
              userPhone: userProfile.phone,
              project: bProject,
              purpose: bPurpose,
              startTime: startIso,
              endTime: endIso,
              date: dateStr,
              repeatGroupId: repeatGroupId,
              attendeeCount,
              needIds: selectedNeeds,
              color: isAdmin && bColor ? bColor : ''
            };
            batchBookings.push(newBooking);
          }

          if (hasOverlap) {
            alert("Một số ngày trong chuỗi lặp lại bị trùng lịch. Vui lòng kiểm tra lại.");
            return;
          }

          await bookingsApi.create(batchBookings);
        }
      }

      const roomName = rooms.find(r => r.id === bRoomId)?.name || bRoomId;
      if (editingBooking) {
        logActivity('Chỉnh sửa đặt phòng', `Phòng: ${roomName}, Ngày: ${bDate}, ${bStartTime}-${bEndTime}`);
      } else if (isRepeat) {
        logActivity('Đặt phòng lặp lại', `Phòng: ${roomName}, Từ: ${bDate} đến ${repeatEndDate}, ${bStartTime}-${bEndTime}`);
      } else {
        logActivity('Đặt phòng', `Phòng: ${roomName}, Ngày: ${bDate}, ${bStartTime}-${bEndTime}`);
      }

      setIsBookingModalOpen(false);
      setEditingBooking(null);
      setBProject('');
      setBPurpose('');
      setIsRepeat(false);
      setRepeatMode('week');
      setRepeatDays([]);
      setRepeatMonthDays([]);
      setSelectedNeeds([]);
      setShowNeeds(false);
      setBAttendeeCount('');
      setBColor('');
      fetchBookings();
    } catch (error) {
      console.error('Booking error:', error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Có lỗi xảy ra. Vui lòng thử lại.';
      alert(message);
    }
  };

  const [deleteChainDialog, setDeleteChainDialog] = useState<{
    isOpen: boolean;
    bookingId: string;
    roomName: string;
    booking: Booking | null;
  }>({ isOpen: false, bookingId: '', roomName: '', booking: null });

  const handleDeleteBooking = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId) || null;
    const roomName = rooms.find(r => r.id === booking?.roomId)?.name || '';

    if (booking?.repeatGroupId) {
      setDeleteChainDialog({ isOpen: true, bookingId, roomName, booking });
    } else {
      setConfirmDialog({
        isOpen: true,
        title: 'Xóa lịch đặt phòng',
        message: 'Bạn có chắc chắn muốn xóa lịch đặt phòng này?',
        onConfirm: async () => {
          try {
            await bookingsApi.delete(bookingId);
            logActivity('Xóa đặt phòng', `Phòng: ${roomName}, Người đặt: ${booking?.userName} (${booking?.userPhone}), Ngày: ${booking?.date}`);
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            fetchBookings();
          } catch (error) {
            console.error('Delete booking error:', error);
          }
        }
      });
    }
  };

  const handleDeleteSingle = async () => {
    const { bookingId, roomName, booking } = deleteChainDialog;
    try {
      await bookingsApi.delete(bookingId);
      logActivity('Xóa đặt phòng', `Phòng: ${roomName}, Người đặt: ${booking?.userName} (${booking?.userPhone}), Ngày: ${booking?.date}`);
      setDeleteChainDialog(prev => ({ ...prev, isOpen: false }));
      fetchBookings();
    } catch (error) {
      console.error('Delete booking error:', error);
    }
  };

  const handleDeleteChain = async () => {
    const { bookingId, roomName, booking } = deleteChainDialog;
    try {
      await bookingsApi.deleteGroup(bookingId);
      logActivity('Xóa chuỗi đặt phòng', `Phòng: ${roomName}, Người đặt: ${booking?.userName} (${booking?.userPhone}), Chuỗi: ${booking?.repeatGroupId}`);
      setDeleteChainDialog(prev => ({ ...prev, isOpen: false }));
      fetchBookings();
    } catch (error) {
      console.error('Delete chain error:', error);
    }
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
    setBBookerName(userProfile?.name || '');
    setBBookerPhone(userProfile?.phone || '');
    if (roomId) setBRoomId(roomId);
    if (date) setBDate(date);
    if (startHour !== undefined) {
      setBStartTime(`${startHour.toString().padStart(2, '0')}:00`);
      setBEndTime(`${(startHour + 1).toString().padStart(2, '0')}:00`);
    }
    setBProject('');
    setBPurpose('');
    setBLocationFilter([]);
    setIsRepeat(false);
    setSelectedNeeds([]);
    setShowNeeds(false);
    setBAttendeeCount('');
    setBColor('');
    setIsBookingModalOpen(true);
  };

  const openBookingDetailsModal = (booking: Booking) => {
    setSelectedBookingDetails(booking);
  };

  const openEditBookingModal = (booking: Booking) => {
    setEditingBooking(booking);
    setBBookerName(booking.userName);
    setBBookerPhone(booking.userPhone);
    setBRoomId(booking.roomId);
    setBDate(booking.date);
    setBStartTime(format(parseISO(booking.startTime), 'HH:mm'));
    setBEndTime(format(parseISO(booking.endTime), 'HH:mm'));
    setBProject(booking.project);
    setBPurpose(booking.purpose);
    setBAttendeeCount(typeof booking.attendeeCount === 'number' ? String(booking.attendeeCount) : '');
    setBColor(booking.color || '');
    setSelectedNeeds(booking.needIds || []);
    setShowNeeds((booking.needIds || []).length > 0);
    setBLocationFilter([]);
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
        color: rColor,
        building: rBuilding,
        floor: rFloor
      };

      if (editingRoom) {
        await roomsApi.update(editingRoom.id, roomData);
        logActivity('Chỉnh sửa phòng', `Phòng: ${rName}`);
      } else {
        await roomsApi.create(roomData as Omit<Room, 'id'>);
        logActivity('Tạo phòng', `Phòng: ${rName}, Sức chứa: ${rCapacity}, Vị trí: ${rLocation}`);
      }

      setEditingRoom(null);
      setRName('');
      setRCapacity(10);
      setRLocation('');
      setRStatus('Đang hoạt động');
      setRColor('#3b82f6');
      setRBuilding('');
      setRFloor('');
      fetchRooms();
    } catch (error) {
      console.error('Room save error:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const handleDeleteRoom = (roomId: string) => {
    const roomName = rooms.find(r => r.id === roomId)?.name || '';
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa phòng họp',
      message: 'Bạn có chắc chắn muốn xóa phòng họp này?',
      onConfirm: async () => {
        try {
          await roomsApi.delete(roomId);
          logActivity('Xóa phòng', `Phòng: ${roomName}`);
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
      setRBuilding(room.building || '');
      setRFloor(room.floor || '');
    } else {
      setEditingRoom(null);
      setRName('');
      setRCapacity(10);
      setRLocation('');
      setRStatus('Đang hoạt động');
      setRColor('#3b82f6');
      setRBuilding('');
      setRFloor('');
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
      logActivity('Tạo phòng mẫu', `Đã tạo ${sampleRooms.length} phòng mẫu`);
      fetchRooms();
    } catch (error) {
      console.error('Seed rooms error:', error);
    }
  };

  const renderMobileDayView = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    return (
      <div className="space-y-3 md:hidden">
        {roomsLoading && sortedRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-6 text-center text-sm text-blue-700">
            Đang tải danh sách phòng họp...
          </div>
        ) : sortedRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            Chưa có phòng họp nào.
          </div>
        ) : (
          sortedRooms.map(room => {
            const isActive = room.status?.includes('hoạt động');
            const dayBookings = bookings
              .filter(b => b.roomId === room.id && b.date === dateStr)
              .sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());

            return (
              <section
                key={room.id}
                className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${!isActive ? 'bg-gray-50 opacity-70' : ''}`}
                style={{ borderLeft: `4px solid ${room.color}` }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className={`text-base font-semibold ${!isActive ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {room.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                        {room.capacity > 0 && <span className="rounded-full bg-gray-100 px-2 py-1">Sức chứa: {room.capacity}</span>}
                        {room.floor && <span className="rounded-full bg-gray-100 px-2 py-1">{room.floor}</span>}
                        {room.building && <span className="rounded-full bg-gray-100 px-2 py-1">{room.building}</span>}
                      </div>
                      {room.location && <p className="mt-2 text-sm text-gray-600">{room.location}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => isActive && openBookingModalWithDefaults(room.id, dateStr, 8)}
                      disabled={!isActive}
                      className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${
                        isActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      Đặt lịch
                    </button>
                  </div>

                  <div className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                    {room.status || 'Chưa cài trạng thái'}
                  </div>

                  {dayBookings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                      Chưa có lịch trong ngày này.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayBookings.map(booking => {
                        const bStart = parseISO(booking.startTime);
                        const bEnd = parseISO(booking.endTime);
                        const isOwner = booking.userPhone === userProfile?.phone;
                        const canEdit = isOwner || isAdmin;
                        const colors = getBookingColors(booking);
                        const bgStyle = colors.length === 1
                          ? { backgroundColor: colors[0] }
                          : { background: `linear-gradient(to right, ${colors.map((c, i) => `${c} ${(i / colors.length) * 100}%, ${c} ${((i + 1) / colors.length) * 100}%`).join(', ')})` };
                        const needNames = (booking.needIds || []).map(nid => needs.find(n => n.id === nid)?.name).filter(Boolean);

                        return (
                          <article
                            key={booking.id}
                            onClick={() => openBookingDetailsModal(booking)}
                            className="rounded-xl border border-gray-200 p-3 shadow-sm cursor-pointer hover:shadow-md"
                            style={bgStyle}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}
                                </div>
                                <div className="text-sm text-gray-800">{booking.userName}</div>
                                <div className="text-xs text-gray-600">SĐT: {booking.userPhone}</div>
                              </div>

                              {canEdit && (
                                <div className="flex shrink-0 gap-1 rounded-lg bg-white/80 p-1 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditBookingModal(booking); }}
                                    className="rounded-md p-2 text-blue-600 hover:bg-blue-50"
                                    title="Sửa"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBooking(booking.id); }}
                                    className="rounded-md p-2 text-red-600 hover:bg-red-50"
                                    title="Xóa"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {(booking.project || booking.purpose || needNames.length > 0) && (
                              <div className="mt-3 space-y-1 text-xs text-gray-700">
                                {booking.project && <div className="break-words whitespace-normal">DA: {booking.project}</div>}
                                {booking.purpose && <div className="break-words whitespace-normal">{booking.purpose}</div>}
                                {needNames.length > 0 && <div className="break-words whitespace-normal font-medium">NC: {needNames.join(', ')}</div>}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    );
  };

  const renderMobileWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="space-y-3 md:hidden">
        {weekDays.map((day, index) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayBookings = bookings
            .filter(b => b.date === dateStr)
            .sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());

          return (
            <section key={dateStr} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">{DAY_NAMES[index]}</div>
                  <div className="text-lg font-bold text-gray-900">{format(day, 'dd/MM/yyyy')}</div>
                </div>

                <button
                  type="button"
                  onClick={() => openBookingModalWithDefaults(undefined, dateStr, 8)}
                  className="shrink-0 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Đặt lịch
                </button>
              </div>

              {dayBookings.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  Chưa có lịch nào trong ngày này.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {dayBookings.map(booking => {
                    const bStart = parseISO(booking.startTime);
                    const bEnd = parseISO(booking.endTime);
                    const isOwner = booking.userPhone === userProfile?.phone;
                    const canEdit = isOwner || isAdmin;
                    const room = rooms.find(r => r.id === booking.roomId);
                    const colors = getBookingColors(booking);
                    const bgStyle = colors.length === 1
                      ? { backgroundColor: colors[0] }
                      : { background: `linear-gradient(to right, ${colors.map((c, i) => `${c} ${(i / colors.length) * 100}%, ${c} ${((i + 1) / colors.length) * 100}%`).join(', ')})` };
                    const needNames = (booking.needIds || []).map(nid => needs.find(n => n.id === nid)?.name).filter(Boolean);

                    return (
                      <article
                        key={booking.id}
                        onClick={() => openBookingDetailsModal(booking)}
                        className="rounded-xl border border-gray-200 p-3 shadow-sm cursor-pointer hover:shadow-md"
                        style={bgStyle}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">
                              {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}
                            </div>
                            <div className="mt-1 text-sm text-gray-800">{room?.name || 'Phòng chưa xác định'}</div>
                            <div className="text-xs text-gray-600">{booking.userName} - {booking.userPhone}</div>
                          </div>

                          {canEdit && (
                            <div className="flex shrink-0 gap-1 rounded-lg bg-white/80 p-1 shadow-sm">
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditBookingModal(booking); }}
                                className="rounded-md p-2 text-blue-600 hover:bg-blue-50"
                                title="Sửa"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteBooking(booking.id); }}
                                className="rounded-md p-2 text-red-600 hover:bg-red-50"
                                title="Xóa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>

                        {(booking.project || booking.purpose || needNames.length > 0) && (
                          <div className="mt-3 space-y-1 text-xs text-gray-700">
                            {booking.project && <div className="break-words whitespace-normal">DA: {booking.project}</div>}
                            {booking.purpose && <div className="break-words whitespace-normal">{booking.purpose}</div>}
                            {needNames.length > 0 && <div className="break-words whitespace-normal font-medium">NC: {needNames.join(', ')}</div>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mobile-scroll">
        <div className="min-w-[960px] xl:min-w-[1200px]">
          {/* Timeline Header */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 shrink-0 border-r border-gray-200 p-4 font-bold text-blue-900 flex items-center justify-center uppercase">
              Phòng Họp
            </div>
            <div className="flex-1 flex">
              {HOURS.map(hour => (
                <div key={hour} className="flex-1 border-r border-gray-200 p-2 text-center text-sm font-bold text-blue-900 min-w-[120px]">
                  {hour}:00
                </div>
              ))}
            </div>
          </div>

          {/* Rooms and Timeline */}
          <div className="divide-y divide-gray-200">
            {roomsLoading && sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-blue-700">Đang tải danh sách phòng họp...</div>
            ) : sortedRooms.length === 0 ? (
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
                  <div className="flex-1 flex relative bg-white min-h-[80px]">
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
                          className={`flex-1 border-r border-gray-100 min-w-[120px] relative transition-colors ${room.status?.includes('hoạt động') ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
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

                      const isOwner = booking.userPhone === userProfile?.phone;
                      const canEdit = isOwner || isAdmin;
                      const colors = getBookingColors(booking);
                      const bgStyle = colors.length === 1
                        ? { backgroundColor: colors[0] }
                        : { background: `linear-gradient(to right, ${colors.map((c, i) => `${c} ${(i/colors.length)*100}%, ${c} ${((i+1)/colors.length)*100}%`).join(', ')})` };
                      const needNames = (booking.needIds || []).map(nid => needs.find(n => n.id === nid)?.name).filter(Boolean);

                      return (
                        <div
                          key={booking.id}
                          onClick={() => openBookingDetailsModal(booking)}
                          className="absolute top-1 bottom-1 rounded-md shadow-sm border border-gray-200 p-1.5 flex flex-col justify-start group/booking z-20 overflow-hidden cursor-pointer hover:shadow-md"
                          style={{
                            left: `${leftPercent}%`,
                            width: `calc(${widthPercent}% - 4px)`,
                            ...bgStyle
                          }}
                          title={`${format(bStart, 'HH:mm')} - ${format(bEnd, 'HH:mm')}: ${booking.userName} (${booking.userPhone})${booking.project ? '\nDA: ' + booking.project : ''}${booking.purpose ? '\n' + booking.purpose : ''}${needNames.length ? '\nNhu cầu: ' + needNames.join(', ') : ''}`}
                        >
                          <div className="text-xs font-semibold text-gray-900 truncate">
                            {format(bStart, 'HH:mm')}-{format(bEnd, 'HH:mm')}: {booking.userName}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            SĐT: {booking.userPhone}
                          </div>
                          {booking.project && <div className="text-xs text-gray-700 truncate">DA: {booking.project}</div>}
                          {booking.purpose && <div className="text-xs text-gray-600 truncate">{booking.purpose}</div>}
                          {needNames.length > 0 && <div className="text-xs text-gray-800 truncate font-medium">NC: {needNames.join(', ')}</div>}
                          
                          {canEdit && (
                            <div className={`absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover/booking:opacity-100 transition-all p-0.5 rounded bg-white/70`}>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto mobile-scroll">
        <div className="min-w-[960px] xl:min-w-[1200px]">
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
            {roomsLoading && sortedRooms.length === 0 ? (
              <div className="p-8 text-center text-blue-700">Đang tải danh sách phòng họp...</div>
            ) : sortedRooms.length === 0 ? (
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
                                const isOwner = booking.userPhone === userProfile?.phone;
                                const canEdit = isOwner || isAdmin;
                                const wColors = getBookingColors(booking);
                                const wBgStyle = wColors.length === 1
                                  ? { backgroundColor: wColors[0] }
                                  : { background: `linear-gradient(to right, ${wColors.map((c, i) => `${c} ${(i/wColors.length)*100}%, ${c} ${((i+1)/wColors.length)*100}%`).join(', ')})` };
                                const wNeedNames = (booking.needIds || []).map(nid => needs.find(n => n.id === nid)?.name).filter(Boolean);

                                return (
                                  <div
                                    key={booking.id}
                                    onClick={() => openBookingDetailsModal(booking)}
                                    className="mb-1 p-1.5 border border-gray-200 rounded text-xs relative group/booking cursor-pointer hover:shadow-md"
                                    style={wBgStyle}
                                  >
                                    <div className="font-semibold text-gray-900 break-words whitespace-normal">
                                      {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}: {booking.userName} ({booking.userPhone})
                                    </div>
                                    {booking.project && <div className="text-gray-700 break-words whitespace-normal">DA: {booking.project}</div>}
                                    {booking.purpose && <div className="text-gray-600 break-words whitespace-normal">{booking.purpose}</div>}
                                    {wNeedNames.length > 0 && <div className="text-gray-800 font-medium">NC: {wNeedNames.join(', ')}</div>}
                                    {canEdit && (
                                      <div className={`absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover/booking:opacity-100 transition-all p-0.5 rounded bg-white/70`}>
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
                                const isOwner = booking.userPhone === userProfile?.phone;
                                const canEdit = isOwner || isAdmin;
                                
                                return (
                                  <div 
                                    key={booking.id} 
                                    onClick={() => openBookingDetailsModal(booking)}
                                    className={`mb-1 p-1.5 border rounded text-xs relative group/booking cursor-pointer hover:shadow-md ${!booking.color ? 'bg-yellow-100 border-yellow-300 hover:border-yellow-400' : ''}`}
                                    style={booking.color ? { backgroundColor: booking.color, borderColor: 'rgba(0,0,0,0.1)' } : {}}
                                  >
                                    <div className="font-semibold text-gray-900 break-words whitespace-normal">
                                      {format(bStart, 'HH:mm')} - {format(bEnd, 'HH:mm')}: {booking.userName} ({booking.userPhone})
                                    </div>
                                    {booking.project && <div className="text-gray-700 break-words whitespace-normal">DA: {booking.project}</div>}
                                    {booking.purpose && <div className="text-gray-600 break-words whitespace-normal">{booking.purpose}</div>}
                                    {canEdit && (
                                      <div className={`absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover/booking:opacity-100 transition-all p-0.5 rounded ${!booking.color ? 'bg-yellow-100/90' : 'bg-white/50'}`}>
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
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-gray-200 px-3 py-3 sticky top-0 z-30 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-blue-900">Lịch Phòng Họp</h1>
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-600">
              <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                {userProfile?.name.charAt(0).toUpperCase() || <UserIcon size={14} />}
              </div>
              <span className="truncate">{userProfile?.name}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-500 underline transition hover:text-red-600"
          >
            Đổi TK
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`flex-1 justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <LayoutGrid size={16} /> Ngày
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <List size={16} /> Tuần
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setSelectedDate(viewMode === 'day' ? subDays(selectedDate, 1) : subDays(selectedDate, 7))}
              className="p-2 hover:bg-white rounded-md transition"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="relative flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-2 font-medium text-gray-800 rounded-md hover:bg-gray-200 transition cursor-pointer">
              <Calendar size={16} className="text-blue-600 shrink-0" />
              <span className="truncate text-sm">
                {viewMode === 'day'
                  ? format(selectedDate, 'dd/MM/yyyy')
                  : `Tuần ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')}`
                }
              </span>
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
              className="p-2 hover:bg-white rounded-md transition"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="shrink-0 rounded-md px-2.5 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
            >
              Hôm nay
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => { setIsLogModalOpen(true); fetchLogs(); }}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-md font-medium hover:bg-gray-200 flex items-center gap-2"
                >
                  <ClipboardList size={16} /> Log
                </button>
                <button
                  onClick={() => setIsRoomModalOpen(true)}
                  className="text-sm bg-purple-100 text-purple-700 px-3 py-2 rounded-md font-medium hover:bg-purple-200 flex items-center gap-2"
                >
                  <Settings size={16} /> Quản lý
                </button>
              </>
            )}
            {rooms.length === 0 && (
              <button
                onClick={seedRooms}
                className="text-sm bg-green-100 text-green-700 px-3 py-2 rounded-md font-medium hover:bg-green-200"
              >
                Tạo phòng mẫu
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:flex bg-white border-b border-gray-200 px-6 py-4 items-center justify-between sticky top-0 z-30 shadow-sm">
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
            <>
              <button
                onClick={() => { setIsLogModalOpen(true); fetchLogs(); }}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md font-medium hover:bg-gray-200 flex items-center gap-2"
              >
                <ClipboardList size={16} /> Log
              </button>
              <button
                onClick={() => setIsRoomModalOpen(true)}
                className="text-sm bg-purple-100 text-purple-700 px-3 py-1.5 rounded-md font-medium hover:bg-purple-200 flex items-center gap-2"
              >
                <Settings size={16} /> Quản lý phòng
              </button>
            </>
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
      <main className="safe-bottom-padding flex-1 overflow-auto p-3 md:p-6">
        <div className="md:hidden">
          {viewMode === 'day' ? renderMobileDayView() : renderMobileWeekView()}
        </div>
        <div className="hidden md:block">
          {viewMode === 'day' ? renderDayView() : renderWeekView()}
        </div>
      </main>

      {/* Floating Action Button - Mobile */}
      <button
        onClick={() => openBookingModalWithDefaults()}
        className="md:hidden safe-fab-offset fixed right-4 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-40"
      >
        <Plus size={24} />
      </button>

      {/* Floating Action Button - Desktop */}
      <button
        onClick={() => openBookingModalWithDefaults()}
        className="hidden md:flex fixed bottom-8 right-8 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg items-center justify-center transition-transform hover:scale-105 z-40"
      >
        <Plus size={28} />
      </button>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-8">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10,11}"
                    maxLength={11}
                    value={profilePhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setProfilePhone(val);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="VD: 0901234567"
                  />
                  {profilePhone && (profilePhone.length < 10 || profilePhone.length > 11) && (
                    <p className="text-red-500 text-xs mt-1">Số điện thoại phải có 10-11 số</p>
                  )}
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
        <div className="fixed inset-0 bg-black/50 flex justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 my-4 sm:my-8 h-fit">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{editingBooking ? 'Chỉnh Sửa Lịch Đặt' : 'Đặt Phòng Họp'}</h2>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveBooking}>
              <div className="space-y-4">
                {/* User Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Người đặt</label>
                    <input type="text" value={bBookerName} onChange={(e) => setBBookerName(e.target.value)} disabled={!isAdmin} className={`w-full border rounded-lg px-3 py-2 ${isAdmin ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none' : 'border-gray-200 bg-gray-50 text-gray-500'}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                    <input type="tel" value={bBookerPhone} onChange={(e) => setBBookerPhone(e.target.value.replace(/\D/g, ''))} disabled={!isAdmin} className={`w-full border rounded-lg px-3 py-2 ${isAdmin ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none' : 'border-gray-200 bg-gray-50 text-gray-500'}`} />
                  </div>
                </div>

                {/* Project & Purpose */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                {/* Room with Location Filter */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1">
                    <label className="block text-sm font-medium text-gray-700">Phòng họp <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-2">
                      {['VP1', 'VP2', 'Xưởng'].map(loc => (
                        <label key={loc} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bLocationFilter.includes(loc)}
                            onChange={(e) => {
                              if (e.target.checked) setBLocationFilter([...bLocationFilter, loc]);
                              else setBLocationFilter(bLocationFilter.filter(l => l !== loc));
                            }}
                            className="w-3.5 h-3.5 text-blue-600 rounded"
                          />
                          <span className="text-xs text-gray-600">{loc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <select
                    required
                    value={bRoomId}
                    onChange={(e) => setBRoomId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Chọn phòng họp --</option>
                    {rooms.filter(r => {
                      const isActive = r.status?.includes('hoạt động') || r.id === bRoomId;
                      if (!isActive) return false;
                      if (bLocationFilter.length === 0) return true;
                      return bLocationFilter.some(loc => (r.building || '').includes(loc));
                    }).map(r => (
                      <option key={r.id} value={r.id}>{r.name}{r.floor ? ` - ${r.floor}` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Màu hiển thị (Tùy chọn - Admin)</label>
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

                {/* Needs + Repeat checkboxes */}
                <div className="border-t border-gray-200 pt-4 mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showNeeds}
                      onChange={(e) => { setShowNeeds(e.target.checked); if (!e.target.checked) setSelectedNeeds([]); }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Nhu cầu</span>
                  </label>
                  {!editingBooking && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRepeat}
                        onChange={(e) => setIsRepeat(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Lặp lại</span>
                    </label>
                  )}
                  <div className="w-full sm:w-auto lg:min-w-[180px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số người</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={bAttendeeCount}
                      onChange={(e) => setBAttendeeCount(e.target.value.replace(/[^\d]/g, ''))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="VD: 12"
                    />
                  </div>
                </div>

                {/* Needs Selection */}
                {showNeeds && needs.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Chọn nhu cầu:</label>
                    <div className="flex flex-wrap gap-2">
                      {needs.map(need => (
                        <button
                          key={need.id}
                          type="button"
                          onClick={() => {
                            if (selectedNeeds.includes(need.id)) {
                              setSelectedNeeds(selectedNeeds.filter(id => id !== need.id));
                            } else {
                              setSelectedNeeds([...selectedNeeds, need.id]);
                            }
                          }}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-2 ${
                            selectedNeeds.includes(need.id)
                              ? 'border-gray-600 ring-2 ring-blue-400 font-semibold'
                              : 'border-gray-300 hover:bg-gray-100'
                          }`}
                          style={{ backgroundColor: selectedNeeds.includes(need.id) ? need.color : undefined }}
                        >
                          <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: need.color }}></div>
                          {need.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repeat Panel */}
                {!editingBooking && isRepeat && (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                        {/* Mode toggle */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Kiểu lặp lại:</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setRepeatMode('week')}
                              className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${
                                repeatMode === 'week' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Tuần
                            </button>
                            <button
                              type="button"
                              onClick={() => setRepeatMode('month')}
                              className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${
                                repeatMode === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              Tháng
                            </button>
                          </div>
                        </div>

                        {/* Weekly: pick days of week */}
                        {repeatMode === 'week' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Lặp lại vào các thứ:</label>
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
                        )}

                        {/* Monthly: pick days of month */}
                        {repeatMode === 'month' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Lặp lại vào các ngày trong tháng:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    if (repeatMonthDays.includes(day)) {
                                      setRepeatMonthDays(repeatMonthDays.filter(d => d !== day));
                                    } else {
                                      setRepeatMonthDays([...repeatMonthDays, day]);
                                    }
                                  }}
                                  className={`w-9 h-9 text-sm rounded-md border transition-colors ${
                                    repeatMonthDays.includes(day)
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Lặp lại đến ngày:</label>
                          <input
                            type="date"
                            required={isRepeat}
                            value={repeatEndDate}
                            onChange={(e) => setRepeatEndDate(e.target.value)}
                            min={bDate}
                            className="w-full sm:max-w-[200px] border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
              </div>

              <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                >
                  {editingBooking ? 'Lưu thay đổi' : 'Xác nhận đặt phòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBookingDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[55] p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 my-4 sm:my-8">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">Thông tin lịch đặt</h2>
              <button
                onClick={() => setSelectedBookingDetails(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Phòng họp</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{bookingDetailsRoom?.name || 'Phòng chưa xác định'}</div>
                  {bookingDetailsRoom?.location && <div className="mt-1 text-sm text-gray-600">{bookingDetailsRoom.location}</div>}
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Thời gian</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {bookingDetailsStart && bookingDetailsEnd
                      ? `${format(bookingDetailsStart, 'HH:mm')} - ${format(bookingDetailsEnd, 'HH:mm')}`
                      : ''}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{selectedBookingDetails.date}</div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Người đặt</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{selectedBookingDetails.userName}</div>
                <div className="mt-1 text-sm text-gray-600">{selectedBookingDetails.userPhone}</div>
              </div>

              {(selectedBookingDetails.project || selectedBookingDetails.purpose || bookingDetailsNeedNames.length > 0 || selectedBookingDetails.repeatGroupId || typeof selectedBookingDetails.attendeeCount === 'number') && (
                <div className="space-y-3">
                  {typeof selectedBookingDetails.attendeeCount === 'number' && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Số người tham dự</div>
                      <div className="mt-1 text-sm text-gray-800">{selectedBookingDetails.attendeeCount} người</div>
                    </div>
                  )}

                  {selectedBookingDetails.project && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Dự án</div>
                      <div className="mt-1 text-sm text-gray-800 break-words whitespace-normal">{selectedBookingDetails.project}</div>
                    </div>
                  )}

                  {selectedBookingDetails.purpose && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Mục đích / ghi chú</div>
                      <div className="mt-1 text-sm text-gray-800 break-words whitespace-normal">{selectedBookingDetails.purpose}</div>
                    </div>
                  )}

                  {bookingDetailsNeedNames.length > 0 && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Nhu cầu</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {bookingDetailsNeedNames.map(name => (
                          <span key={name} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBookingDetails.repeatGroupId && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Chuỗi lặp lại</div>
                      <div className="mt-1 text-sm text-gray-800">Booking này thuộc một chuỗi lịch lặp lại.</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedBookingDetails(null)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
              >
                Đóng
              </button>

              {canManageSelectedBooking && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const booking = selectedBookingDetails;
                      if (!booking) return;
                      setSelectedBookingDetails(null);
                      openEditBookingModal(booking);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                  >
                    Sửa lịch
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const booking = selectedBookingDetails;
                      if (!booking) return;
                      setSelectedBookingDetails(null);
                      handleDeleteBooking(booking.id);
                    }}
                    className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition shadow-sm"
                  >
                    Xóa lịch
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Room Management Modal (Admin Only) */}
      {isRoomModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-4 sm:p-6 my-4 sm:my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Quản lý</h2>
              <button onClick={() => setIsRoomModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
              <button
                onClick={() => setAdminTab('rooms')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${adminTab === 'rooms' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Phòng họp
              </button>
              <button
                onClick={() => setAdminTab('needs')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${adminTab === 'needs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Nhu cầu
              </button>
              <button
                onClick={() => setAdminTab('admins')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${adminTab === 'admins' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Cấp quyền
              </button>
            </div>

            {adminTab === 'rooms' && (
            <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
              {/* Room List */}
              <div className="w-full xl:w-1/2 xl:border-r border-gray-200 xl:pr-6 overflow-y-auto">
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
              <div className="w-full xl:w-1/2 xl:pl-2 overflow-y-auto">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Khu vực</label>
                      <select
                        value={rBuilding}
                        onChange={(e) => setRBuilding(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="">-- Chọn --</option>
                        <option value="VP1">VP1</option>
                        <option value="VP2">VP2</option>
                        <option value="Xưởng">Xưởng</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tầng</label>
                      <input
                        type="text"
                        value={rFloor}
                        onChange={(e) => setRFloor(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="VD: Tầng 2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí chi tiết</label>
                    <input
                      type="text"
                      value={rLocation}
                      onChange={(e) => setRLocation(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Mô tả vị trí chi tiết"
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

                  <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
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
            )}

            {adminTab === 'needs' && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col xl:flex-row gap-6">
                {/* Needs List */}
                <div className="w-full xl:w-1/2 xl:border-r border-gray-200 xl:pr-6">
                  <h3 className="font-semibold text-gray-700 mb-4">Danh sách nhu cầu</h3>
                  <div className="space-y-2">
                    {needs.map(need => (
                      <div key={need.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:border-blue-300">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: need.color }}></div>
                          <span className="font-medium text-gray-900 text-sm">{need.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditingNeed(need); setNName(need.name); setNColor(need.color); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Xóa nhu cầu',
                                message: `Bạn có chắc chắn muốn xóa "${need.name}"?`,
                                onConfirm: async () => {
                                  await needsApi.delete(need.id);
                                  logActivity('Xóa nhu cầu', `Nhu cầu: ${need.name}`);
                                  fetchNeeds();
                                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {needs.length === 0 && <div className="text-gray-500 text-sm">Chưa có nhu cầu nào.</div>}
                  </div>
                </div>

                {/* Need Form */}
                <div className="w-full xl:w-1/2 xl:pl-2">
                  <h3 className="font-semibold text-gray-700 mb-4">{editingNeed ? 'Sửa nhu cầu' : 'Thêm nhu cầu mới'}</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!nName) return;
                    try {
                      if (editingNeed) {
                        await needsApi.update(editingNeed.id, { name: nName, color: nColor, sort_order: editingNeed.sort_order });
                        logActivity('Chỉnh sửa nhu cầu', `Nhu cầu: ${nName}`);
                      } else {
                        await needsApi.create({ name: nName, color: nColor, sort_order: needs.length + 1 });
                        logActivity('Tạo nhu cầu', `Nhu cầu: ${nName}, Màu: ${nColor}`);
                      }
                      setEditingNeed(null);
                      setNName('');
                      setNColor('#fbbf24');
                      fetchNeeds();
                    } catch (err) {
                      console.error('Need save error:', err);
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhu cầu <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={nName}
                        onChange={(e) => setNName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="VD: Trái cây"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Màu sắc</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={nColor}
                          onChange={(e) => setNColor(e.target.value)}
                          className="w-10 h-10 border-0 p-0 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-500">{nColor}</span>
                      </div>
                    </div>
                    <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                      {editingNeed && (
                        <button
                          type="button"
                          onClick={() => { setEditingNeed(null); setNName(''); setNColor('#fbbf24'); }}
                          className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
                        >
                          Hủy sửa
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                      >
                        {editingNeed ? 'Lưu thay đổi' : 'Thêm nhu cầu'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            )}

            {adminTab === 'admins' && (
            <div className="flex-1 overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">Thêm số điện thoại để cấp quyền admin. Tài khoản gốc (admin-pos / 6530042026) luôn có quyền.</p>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="tel"
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Nhập số điện thoại"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newAdminPhone) return;
                    await adminPhonesApi.add(newAdminPhone);
                    logActivity('Cấp quyền admin', `SĐT: ${newAdminPhone}`);
                    setAdminPhones([...adminPhones, newAdminPhone]);
                    setNewAdminPhone('');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition shadow-sm"
                >
                  Thêm
                </button>
              </div>
              <div className="space-y-2">
                {adminPhones.map(phone => (
                  <div key={phone} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <span className="font-medium text-gray-900">{phone}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminPhonesApi.remove(phone);
                        logActivity('Xóa quyền admin', `SĐT: ${phone}`);
                        setAdminPhones(adminPhones.filter(p => p !== phone));
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {adminPhones.length === 0 && <div className="text-gray-500 text-sm">Chưa có số điện thoại nào được cấp quyền.</div>}
              </div>
            </div>
            )}

          </div>
        </div>
      )}

      {/* Activity Log Modal */}
      {isLogModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-4 sm:p-6 my-4 sm:my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={20} /> Nhật ký hoạt động
              </h2>
              <button onClick={() => setIsLogModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                &times;
              </button>
            </div>

            {logsLoading ? (
              <div className="text-center py-8 text-gray-500">Đang tải...</div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Chưa có hoạt động nào.</div>
            ) : (
              <div className="overflow-auto flex-1 mobile-scroll">
                <div className="space-y-3 sm:hidden">
                  {activityLogs.map(log => (
                    <article key={log.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="text-xs text-gray-500">{new Date(log.createdAt + 'Z').toLocaleString('vi-VN')}</div>
                      <div className="mt-2 font-medium text-gray-900">{log.userName}</div>
                      <div className="text-xs text-gray-500">{log.userPhone}</div>
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.action.includes('Xóa') ? 'bg-red-100 text-red-700' :
                          log.action.includes('Đăng nhập') ? 'bg-blue-100 text-blue-700' :
                          log.action.includes('Chỉnh sửa') ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                      {log.detail && <div className="mt-2 text-sm text-gray-600 break-words whitespace-normal">{log.detail}</div>}
                    </article>
                  ))}
                </div>

                <table className="hidden sm:table w-full text-sm min-w-[720px]">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-semibold text-gray-700">Thời gian</th>
                      <th className="text-left p-2 font-semibold text-gray-700">Người dùng</th>
                      <th className="text-left p-2 font-semibold text-gray-700">Hành động</th>
                      <th className="text-left p-2 font-semibold text-gray-700">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activityLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-2 text-gray-500 whitespace-nowrap">
                          {new Date(log.createdAt + 'Z').toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2">
                          <div className="font-medium text-gray-900">{log.userName}</div>
                          <div className="text-xs text-gray-500">{log.userPhone}</div>
                        </td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.action.includes('Xóa') ? 'bg-red-100 text-red-700' :
                            log.action.includes('Đăng nhập') ? 'bg-blue-100 text-blue-700' :
                            log.action.includes('Chỉnh sửa') ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2 text-gray-600 max-w-[250px] truncate" title={log.detail}>
                          {log.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Chain Dialog */}
      {deleteChainDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa lịch đặt phòng</h3>
            <p className="text-gray-600 mb-2">Khung giờ này thuộc một chuỗi lặp lại.</p>
            <p className="text-gray-600 mb-6">Bạn muốn xóa chỉ khung giờ này hay xóa toàn bộ chuỗi?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteSingle}
                className="w-full px-4 py-2.5 bg-orange-500 text-white font-medium hover:bg-orange-600 rounded-lg transition shadow-sm"
              >
                Xóa chỉ khung giờ này
              </button>
              <button
                onClick={handleDeleteChain}
                className="w-full px-4 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition shadow-sm"
              >
                Xóa toàn bộ chuỗi
              </button>
              <button
                onClick={() => setDeleteChainDialog(prev => ({ ...prev, isOpen: false }))}
                className="w-full px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition"
              >
                Hủy
              </button>
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
